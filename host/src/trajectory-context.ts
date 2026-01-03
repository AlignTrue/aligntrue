import { Identity, Trajectories, type TrajectoryStore } from "@aligntrue/core";

type TrajectoryStepType = Trajectories.TrajectoryStepType;
type TrajectoryStepPayloadByType = Trajectories.TrajectoryStepPayloadByType;
type TrajectoryRefs = Trajectories.TrajectoryRefs;
type StepResult = { step_seq: number; step_id: string };

export interface TrajectoryBudgets {
  steps_remaining: number;
  time_remaining_ms: number;
  writes_remaining: number;
  egress_remaining: number;
}

export type VolumePolicy =
  | "emit"
  | "sample"
  | "summarize"
  | "aggregate"
  | "drop";

export interface VolumeControlConfig {
  entity_read: VolumePolicy;
  entity_written: VolumePolicy;
  tool_called: VolumePolicy;
  policy_gate_hit: VolumePolicy;
  external_egress_attempted: VolumePolicy;
  sample_rate?: number; // 0.0 - 1.0; used when policy === "sample"
}

const DEFAULT_BUDGETS: TrajectoryBudgets = {
  steps_remaining: 100,
  time_remaining_ms: 30_000,
  writes_remaining: 10,
  egress_remaining: 5,
};

const DEFAULT_VOLUME: VolumeControlConfig = {
  entity_read: "sample",
  entity_written: "emit",
  tool_called: "summarize",
  policy_gate_hit: "emit",
  external_egress_attempted: "emit",
  sample_rate: 0.1,
};

export interface CreateTrajectoryContextOpts {
  store: TrajectoryStore;
  correlation_id: string;
  trajectory_id?: string;
  budgets?: Partial<TrajectoryBudgets>;
  volume?: Partial<VolumeControlConfig>;
  started_at?: number; // epoch ms for deterministic budget checks
}

export interface TrajectoryContext {
  trajectory_id: string;
  correlation_id: string;
  current_step_seq: number;
  prev_step_hash: string | null;
  budgets: TrajectoryBudgets;
  emitStep<T extends TrajectoryStepType>(
    type: T,
    payload: TrajectoryStepPayloadByType[T],
    refs: TrajectoryRefs,
    causation?: { related_command_id?: string; related_event_id?: string },
  ): Promise<StepResult>;
  start(
    trigger: string,
    context?: Record<string, unknown>,
  ): Promise<StepResult>;
  end(outcome_summary?: string): Promise<StepResult>;
}

export function createTrajectoryContext(
  opts: CreateTrajectoryContextOpts,
): TrajectoryContext {
  const trajectory_id = opts.trajectory_id ?? Identity.randomId();
  const startedAt = opts.started_at ?? Date.now();
  const budgets: TrajectoryBudgets = { ...DEFAULT_BUDGETS, ...opts.budgets };
  const volume: VolumeControlConfig = { ...DEFAULT_VOLUME, ...opts.volume };

  let currentStepSeq = -1;
  let prevStepHash: string | null = null;

  async function emit<T extends TrajectoryStepType>(
    type: T,
    payload: TrajectoryStepPayloadByType[T],
    refs: TrajectoryRefs,
    causation?: { related_command_id?: string; related_event_id?: string },
  ): Promise<StepResult> {
    enforceTimeBudget(startedAt, budgets);
    enforceStepBudget(budgets);
    enforceResourceBudgets(type, budgets);

    const policy = volumePolicyFor(type, volume);
    if (policy === "drop") {
      return { step_seq: currentStepSeq, step_id: prevStepHash ?? "" };
    }
    if (
      policy === "sample" &&
      !deterministicSample(
        trajectory_id,
        type,
        currentStepSeq + 1,
        volume.sample_rate ?? 0.1,
      )
    ) {
      return { step_seq: currentStepSeq, step_id: prevStepHash ?? "" };
    }

    const step_seq = currentStepSeq + 1;
    const event = Trajectories.buildTrajectoryEvent({
      trajectory_id,
      step_seq,
      prev_step_hash: prevStepHash,
      step_type: type,
      producer: "host",
      timestamp: new Date().toISOString(),
      correlation_id: opts.correlation_id,
      refs,
      ...(causation ? { causation } : {}),
      payload,
    });

    await opts.store.appendStep(event);
    currentStepSeq = step_seq;
    prevStepHash = event.step_id;
    decrementBudgets(type, budgets);
    return { step_seq, step_id: event.step_id };
  }

  return {
    trajectory_id,
    correlation_id: opts.correlation_id,
    get current_step_seq() {
      return currentStepSeq;
    },
    get prev_step_hash() {
      return prevStepHash;
    },
    budgets,
    emitStep: emit,
    start(trigger: string, context?: Record<string, unknown>) {
      return emit(
        "trajectory_started",
        { trigger, ...(context ? { context } : {}) },
        { entity_refs: [], artifact_refs: [], external_refs: [] },
      );
    },
    end(outcome_summary?: string) {
      return emit(
        "trajectory_ended",
        { ...(outcome_summary ? { outcome_summary } : {}) },
        { entity_refs: [], artifact_refs: [], external_refs: [] },
      );
    },
  };
}

function volumePolicyFor(
  type: TrajectoryStepType,
  volume: VolumeControlConfig,
): VolumePolicy {
  if (type === "entity_read") return volume.entity_read;
  if (type === "entity_written") return volume.entity_written;
  if (type === "tool_called") return volume.tool_called;
  if (type === "policy_gate_hit") return volume.policy_gate_hit;
  if (type === "external_egress_attempted")
    return volume.external_egress_attempted;
  return "emit";
}

function deterministicSample(
  trajectory_id: string,
  type: string,
  step_seq: number,
  rate: number,
): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  const seed = `${trajectory_id}:${type}:${step_seq}`;
  const hash = Identity.deterministicId(seed);
  // Use last 8 hex chars for a stable fraction
  const tail = hash.slice(-8);
  const intVal = parseInt(tail, 16);
  const fraction = intVal / 0x100000000;
  return fraction < rate;
}

function enforceTimeBudget(startedAt: number, budgets: TrajectoryBudgets) {
  const elapsed = Date.now() - startedAt;
  if (elapsed > budgets.time_remaining_ms) {
    throw new Error("Trajectory time budget exceeded");
  }
}

function enforceStepBudget(budgets: TrajectoryBudgets) {
  if (budgets.steps_remaining <= 0) {
    throw new Error("Trajectory step budget exceeded");
  }
}

function enforceResourceBudgets(
  type: TrajectoryStepType,
  budgets: TrajectoryBudgets,
) {
  if (type === "entity_written" && budgets.writes_remaining <= 0) {
    throw new Error("Trajectory write budget exceeded");
  }
  if (type === "external_egress_attempted" && budgets.egress_remaining <= 0) {
    throw new Error("Trajectory egress budget exceeded");
  }
}

function decrementBudgets(
  type: TrajectoryStepType,
  budgets: TrajectoryBudgets,
): void {
  budgets.steps_remaining -= 1;
  if (type === "entity_written") budgets.writes_remaining -= 1;
  if (type === "external_egress_attempted") budgets.egress_remaining -= 1;
}
