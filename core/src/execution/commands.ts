import { BaseLedger } from "../ledger/base-ledger.js";
import {
  type CommandEnvelope,
  type CommandOutcome,
} from "../envelopes/index.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import { PreconditionFailed } from "../errors.js";
import {
  EXECUTION_EVENT_TYPES,
  EXECUTION_SCHEMA_VERSION,
  type ExecutionEvent,
} from "./events.js";
import {
  type RunId,
  type StepId,
  type ProofRef,
  type StepKind,
} from "./types.js";
import { routeStep } from "./router.js";
import { BudgetTracker } from "./budget.js";
import { reduceEvent, initialState } from "./state-machine.js";

const EXECUTION_ENVELOPE_VERSION = 1;

type CommandApplicationResult = {
  events: ExecutionEvent[];
  reason?: string;
  outcomeStatus?: CommandOutcome["status"];
};

export type ExecutionCommandType =
  | "run.start"
  | "run.complete"
  | "run.cancel"
  | "step.attempt"
  | "step.succeed"
  | "step.fail";

type RunStartPayload = { run_id: RunId; target_ref?: string };
type RunCompletePayload = { run_id: RunId };
type RunCancelPayload = { run_id: RunId; reason?: string };
type StepAttemptPayload = {
  run_id: RunId;
  step_id: StepId;
  kind: StepKind;
  metadata?: Record<string, unknown>;
};
type StepSucceedPayload = {
  run_id: RunId;
  step_id: StepId;
  proof_refs: ProofRef[];
  router_decision_ref?: string;
  started_at?: string;
  completed_at?: string;
};
type StepFailPayload = {
  run_id: RunId;
  step_id: StepId;
  reason: string;
  proof_refs?: ProofRef[];
  router_decision_ref?: string;
  started_at?: string;
  completed_at?: string;
};

type ExecutionCommand =
  | CommandEnvelope<"run.start", RunStartPayload>
  | CommandEnvelope<"run.complete", RunCompletePayload>
  | CommandEnvelope<"run.cancel", RunCancelPayload>
  | CommandEnvelope<"step.attempt", StepAttemptPayload>
  | CommandEnvelope<"step.succeed", StepSucceedPayload>
  | CommandEnvelope<"step.fail", StepFailPayload>;

export type ExecutionCommandEnvelope<
  T extends ExecutionCommandType = ExecutionCommandType,
> = Extract<ExecutionCommand, { command_type: T }>;

export class ExecutionRuntime extends BaseLedger<
  ReturnType<typeof initialState>,
  ExecutionCommandEnvelope,
  ExecutionEvent
> {
  private readonly budget: BudgetTracker;

  constructor(
    eventStore: EventStore,
    commandLog: CommandLog,
    opts?: { budget?: BudgetTracker; now?: () => string },
  ) {
    super(eventStore, commandLog, opts);
    this.budget = opts?.budget ?? new BudgetTracker();
  }

  protected initialState(): ReturnType<typeof initialState> {
    return initialState();
  }

  protected reduceEvent(
    state: ReturnType<typeof initialState>,
    event: ExecutionEvent,
  ): ReturnType<typeof initialState> {
    return reduceEvent(state, event);
  }

  protected envelopeVersion(): number {
    return EXECUTION_ENVELOPE_VERSION;
  }

  protected payloadSchemaVersion(): number {
    return EXECUTION_SCHEMA_VERSION;
  }

  protected async applyCommand(
    command: ExecutionCommandEnvelope,
    state: ReturnType<typeof initialState>,
  ): Promise<CommandApplicationResult> {
    switch (command.command_type) {
      case "run.start":
        return this.handleRunStart(command, state);
      case "run.complete":
        return this.handleRunComplete(command, state);
      case "run.cancel":
        return this.handleRunCancel(command, state);
      case "step.attempt":
        return this.handleStepAttempt(command, state);
      case "step.succeed":
        return this.handleStepSucceed(command, state);
      case "step.fail":
        return this.handleStepFail(command, state);
      default:
        return {
          events: [],
          outcomeStatus: "rejected",
          reason: "Unsupported command type",
        };
    }
  }

  private handleRunStart(
    command: ExecutionCommandEnvelope<"run.start">,
    state: ReturnType<typeof initialState>,
  ): CommandApplicationResult {
    if (state.runs.has(command.payload.run_id)) {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Run already started",
      };
    }

    const event = this.buildEvent(command, EXECUTION_EVENT_TYPES.RunStarted, {
      run_id: command.payload.run_id,
      ...(command.payload.target_ref
        ? { target_ref: command.payload.target_ref }
        : {}),
    });
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleRunComplete(
    command: ExecutionCommandEnvelope<"run.complete">,
    state: ReturnType<typeof initialState>,
  ): CommandApplicationResult {
    const run = state.runs.get(command.payload.run_id);
    if (!run) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (run.status !== "running") {
      return { events: [], outcomeStatus: "already_processed" };
    }
    const event = this.buildEvent(command, EXECUTION_EVENT_TYPES.RunCompleted, {
      run_id: command.payload.run_id,
    });
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleRunCancel(
    command: ExecutionCommandEnvelope<"run.cancel">,
    state: ReturnType<typeof initialState>,
  ): CommandApplicationResult {
    const run = state.runs.get(command.payload.run_id);
    if (!run) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (run.status !== "running") {
      return { events: [], outcomeStatus: "already_processed" };
    }
    const event = this.buildEvent(command, EXECUTION_EVENT_TYPES.RunCancelled, {
      run_id: command.payload.run_id,
      ...(command.payload.reason ? { reason: command.payload.reason } : {}),
    });
    reduceEvent(state, event);
    return { events: [event] };
  }

  private async handleStepAttempt(
    command: ExecutionCommandEnvelope<"step.attempt">,
    state: ReturnType<typeof initialState>,
  ): Promise<CommandApplicationResult> {
    const run = state.runs.get(command.payload.run_id);
    if (!run) throw new PreconditionFailed("run_exists", "missing");
    if (run.status !== "running") {
      return {
        events: [],
        outcomeStatus: "rejected",
        reason: "Run not running",
      };
    }

    const { decision, receipt } = routeStep(
      {
        run_id: command.payload.run_id,
        step_id: command.payload.step_id,
        kind: command.payload.kind,
        ...(command.payload.metadata
          ? { metadata: command.payload.metadata }
          : {}),
      },
      {
        actor: command.actor,
        correlation_id: command.correlation_id,
        now: () => this.now(),
      },
    );

    const event = this.buildEvent(
      command,
      EXECUTION_EVENT_TYPES.StepAttempted,
      {
        run_id: command.payload.run_id,
        step_id: command.payload.step_id,
        kind: command.payload.kind,
        route: decision.route,
        router_decision_ref: receipt.receipt_id,
        requested_at: command.requested_at,
      },
    );

    reduceEvent(state, event);
    return { events: [event] };
  }

  private async handleStepSucceed(
    command: ExecutionCommandEnvelope<"step.succeed">,
    state: ReturnType<typeof initialState>,
  ): Promise<CommandApplicationResult> {
    const run = state.runs.get(command.payload.run_id);
    if (!run) throw new PreconditionFailed("run_exists", "missing");
    if (run.status !== "running") {
      return {
        events: [],
        outcomeStatus: "rejected",
        reason: "Run not running",
      };
    }
    if (
      !command.payload.proof_refs ||
      command.payload.proof_refs.length === 0
    ) {
      return {
        events: [],
        outcomeStatus: "rejected",
        reason: "proof_refs_required",
      };
    }

    const event = this.buildEvent(
      command,
      EXECUTION_EVENT_TYPES.StepSucceeded,
      {
        run_id: command.payload.run_id,
        step_id: command.payload.step_id,
        proof_refs: command.payload.proof_refs,
        router_decision_ref: command.payload.router_decision_ref,
        started_at:
          command.payload.started_at ??
          run.steps.get(command.payload.step_id)?.started_at ??
          command.requested_at,
        completed_at: command.payload.completed_at ?? this.now(),
      },
    );
    reduceEvent(state, event);
    return { events: [event] };
  }

  private async handleStepFail(
    command: ExecutionCommandEnvelope<"step.fail">,
    state: ReturnType<typeof initialState>,
  ): Promise<CommandApplicationResult> {
    const run = state.runs.get(command.payload.run_id);
    if (!run) throw new PreconditionFailed("run_exists", "missing");
    if (run.status !== "running") {
      return {
        events: [],
        outcomeStatus: "rejected",
        reason: "Run not running",
      };
    }
    const event = this.buildEvent(command, EXECUTION_EVENT_TYPES.StepFailed, {
      run_id: command.payload.run_id,
      step_id: command.payload.step_id,
      reason: command.payload.reason,
      proof_refs: command.payload.proof_refs ?? [],
      router_decision_ref: command.payload.router_decision_ref,
      started_at:
        command.payload.started_at ??
        run.steps.get(command.payload.step_id)?.started_at,
      completed_at:
        command.payload.completed_at ??
        run.steps.get(command.payload.step_id)?.completed_at ??
        this.now(),
    });
    reduceEvent(state, event);
    return { events: [event] };
  }
}
