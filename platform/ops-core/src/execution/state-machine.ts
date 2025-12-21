import type { ExecutionEvent } from "./events.js";
import type {
  ProofRef,
  RunId,
  RunState,
  RunStatus,
  StepId,
  StepRoute,
  StepState,
  StepStatus,
} from "./types.js";

export interface ExecutionState {
  runs: Map<RunId, RunState>;
}

export function initialState(): ExecutionState {
  return { runs: new Map() };
}

export function reduceEvent(
  state: ExecutionState,
  event: ExecutionEvent,
): ExecutionState {
  switch (event.event_type) {
    case "run_started":
      return handleRunStarted(state, event.payload.run_id, event.occurred_at);
    case "run_completed":
      return updateRunStatus(state, event.payload.run_id, "completed", event);
    case "run_cancelled":
      return updateRunStatus(
        state,
        event.payload.run_id,
        "cancelled",
        event,
        event.payload.reason,
      );
    case "step_attempted":
      return handleStepAttempted(state, {
        run_id: event.payload.run_id,
        step_id: event.payload.step_id,
        kind: event.payload.kind,
        route: event.payload.route,
        started_at: event.occurred_at,
        router_decision_ref: event.payload.router_decision_ref,
      });
    case "step_succeeded":
      return handleStepResult(state, {
        run_id: event.payload.run_id,
        step_id: event.payload.step_id,
        status: "succeeded",
        proof_refs: event.payload.proof_refs,
        router_decision_ref: event.payload.router_decision_ref,
        started_at: event.payload.started_at,
        completed_at: event.payload.completed_at,
      });
    case "step_failed":
      return handleStepResult(state, {
        run_id: event.payload.run_id,
        step_id: event.payload.step_id,
        status: "failed",
        proof_refs: event.payload.proof_refs ?? [],
        router_decision_ref: event.payload.router_decision_ref,
        started_at: event.payload.started_at,
        completed_at: event.payload.completed_at ?? event.occurred_at,
        reason: event.payload.reason,
      });
    default:
      return state;
  }
}

function handleRunStarted(
  state: ExecutionState,
  runId: RunId,
  startedAt: string,
): ExecutionState {
  if (!state.runs.has(runId)) {
    const run: RunState = {
      run_id: runId,
      status: "running",
      steps: new Map(),
      started_at: startedAt,
    };
    state.runs.set(runId, run);
  }
  return state;
}

function updateRunStatus(
  state: ExecutionState,
  runId: RunId,
  status: RunStatus,
  event: ExecutionEvent,
  reason?: string,
): ExecutionState {
  const run = state.runs.get(runId);
  if (!run) return state;
  if (run.status !== "running") return state;
  run.status = status;
  run.completed_at = event.occurred_at;
  if (status === "cancelled" && reason) {
    // annotate steps still pending/in_progress
    for (const step of run.steps.values()) {
      if (step.status === "pending" || step.status === "in_progress") {
        step.status = "cancelled";
        step.reason = reason;
        step.completed_at = event.occurred_at;
      }
    }
  }
  return state;
}

function handleStepAttempted(
  state: ExecutionState,
  input: {
    run_id: RunId;
    step_id: StepId;
    kind: StepState["kind"];
    route: StepRoute | undefined;
    started_at: string;
    router_decision_ref?: string | undefined;
  },
): ExecutionState {
  const run = state.runs.get(input.run_id);
  if (!run || run.status !== "running") return state;

  const existing = run.steps.get(input.step_id);
  const next: StepState = existing ?? {
    step_id: input.step_id,
    kind: input.kind,
    route: input.route,
    status: "in_progress",
    proof_refs: [],
    started_at: input.started_at,
  };

  next.kind = input.kind;
  next.route = input.route ?? next.route;
  next.status = "in_progress";
  next.started_at = input.started_at;
  next.router_decision_ref =
    input.router_decision_ref ?? next.router_decision_ref;
  run.steps.set(input.step_id, next);
  return state;
}

function handleStepResult(
  state: ExecutionState,
  input: {
    run_id: RunId;
    step_id: StepId;
    status: StepStatus;
    proof_refs: ProofRef[];
    router_decision_ref?: string | undefined;
    started_at?: string | undefined;
    completed_at: string;
    reason?: string | undefined;
  },
): ExecutionState {
  const run = state.runs.get(input.run_id);
  if (!run || run.status !== "running") return state;

  const existing = run.steps.get(input.step_id);
  const next: StepState = existing
    ? { ...existing, proof_refs: [...existing.proof_refs] }
    : {
        step_id: input.step_id,
        kind: "unknown",
        status: input.status,
        proof_refs: [...input.proof_refs],
        started_at: input.started_at ?? input.completed_at,
        completed_at: input.completed_at,
      };

  next.kind = existing?.kind ?? next.kind ?? "unknown";
  next.status = input.status;
  next.proof_refs = [...input.proof_refs];
  next.completed_at = input.completed_at;
  if (input.started_at) {
    next.started_at = input.started_at;
  }
  if (input.router_decision_ref) {
    next.router_decision_ref = input.router_decision_ref;
  }
  if (input.reason) {
    next.reason = input.reason;
  }
  run.steps.set(input.step_id, next);
  return state;
}

export function cloneState(state: ExecutionState): ExecutionState {
  const runs = new Map<RunId, RunState>();
  for (const [runId, run] of state.runs.entries()) {
    const steps = new Map<StepId, StepState>();
    for (const [stepId, step] of run.steps.entries()) {
      steps.set(stepId, { ...step, proof_refs: [...step.proof_refs] });
    }
    runs.set(runId, { ...run, steps });
  }
  return { runs };
}
