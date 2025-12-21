import { PreconditionFailed, ValidationError } from "../errors.js";
import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import { generateEventId } from "../identity/id.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
import {
  TASK_EVENT_TYPES,
  TASKS_SCHEMA_VERSION,
  type TaskCompletedPayload,
  type TaskCreatedPayload,
  type TaskEvent,
  type TaskEventType,
  type TaskReopenedPayload,
  type TaskTriagedPayload,
} from "./events.js";
import {
  initialState,
  reduceEvent,
  type TaskBucket,
  type TaskState,
  type TasksLedgerState,
} from "./state-machine.js";
import type { TaskEffort, TaskImpact } from "./types.js";

export type TaskCommandType =
  | "task.create"
  | "task.triage"
  | "task.complete"
  | "task.reopen";

export type TaskCommandPayload =
  | TaskCreatedPayload
  | TaskTriagedPayload
  | TaskCompletedPayload
  | TaskReopenedPayload;

export type TaskCommandEnvelope<T extends TaskCommandType = TaskCommandType> =
  CommandEnvelope<T, TaskCommandPayload>;

export interface TaskCommandContext {
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly now?: () => string;
}

export class TaskLedger {
  private readonly now: () => string;

  constructor(
    private readonly eventStore: EventStore,
    private readonly commandLog: CommandLog,
    opts?: { now?: () => string },
  ) {
    this.now = opts?.now ?? (() => new Date().toISOString());
  }

  async execute(
    command: CommandEnvelope<TaskCommandType, TaskCommandPayload>,
  ): Promise<CommandOutcome> {
    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) {
      return existing;
    }

    await this.commandLog.record(command);
    const state = await this.loadState();
    const { events, reason, outcomeStatus } = this.applyCommand(command, state);

    for (const event of events) {
      await this.eventStore.append(event);
    }

    const outcome: CommandOutcome = {
      command_id: command.command_id,
      status:
        outcomeStatus ?? (events.length > 0 ? "accepted" : "already_processed"),
      produced_events: events.map((e) => e.event_id),
      completed_at: this.now(),
      ...(reason ? { reason } : {}),
    };

    await this.commandLog.recordOutcome(outcome);
    return outcome;
  }

  private applyCommand(
    command: CommandEnvelope<TaskCommandType, TaskCommandPayload>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string | undefined;
    outcomeStatus?: CommandOutcome["status"] | undefined;
  } {
    switch (command.command_type) {
      case "task.create":
        return this.handleCreate(
          command as CommandEnvelope<"task.create", TaskCreatedPayload>,
          state,
        );
      case "task.triage":
        return this.handleTriage(
          command as CommandEnvelope<"task.triage", TaskTriagedPayload>,
          state,
        );
      case "task.complete":
        return this.handleComplete(
          command as CommandEnvelope<"task.complete", TaskCompletedPayload>,
          state,
        );
      case "task.reopen":
        return this.handleReopen(
          command as CommandEnvelope<"task.reopen", TaskReopenedPayload>,
          state,
        );
      default:
        throw new ValidationError(
          `Unsupported command type: ${command.command_type}`,
        );
    }
  }

  private handleCreate(
    command: CommandEnvelope<"task.create", TaskCreatedPayload>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    if (state.tasks.has(command.payload.task_id)) {
      throw new PreconditionFailed("missing", "exists");
    }

    const payload: TaskCreatedPayload = {
      ...command.payload,
      bucket: command.payload.bucket ?? "today",
      status: "open",
    };

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskCreated,
      payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleTriage(
    command: CommandEnvelope<"task.triage", TaskTriagedPayload>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const existing = state.tasks.get(command.payload.task_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }

    const hasChange =
      command.payload.bucket !== undefined ||
      command.payload.impact !== undefined ||
      command.payload.effort !== undefined ||
      command.payload.due_at !== undefined ||
      command.payload.title !== undefined;

    if (!hasChange) {
      return { events: [], outcomeStatus: "already_processed" };
    }

    if (command.payload.bucket && !isValidBucket(command.payload.bucket)) {
      throw new PreconditionFailed("valid_bucket", command.payload.bucket);
    }
    if (command.payload.impact && !isValidImpact(command.payload.impact)) {
      throw new PreconditionFailed("impact_L_M_H", command.payload.impact);
    }
    if (command.payload.effort && !isValidEffort(command.payload.effort)) {
      throw new PreconditionFailed("effort_S_M_L", command.payload.effort);
    }

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskTriaged,
      command.payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleComplete(
    command: CommandEnvelope<"task.complete", TaskCompletedPayload>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const existing = state.tasks.get(command.payload.task_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (existing.status === "completed") {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Task already completed",
      };
    }

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskCompleted,
      command.payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleReopen(
    command: CommandEnvelope<"task.reopen", TaskReopenedPayload>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const existing = state.tasks.get(command.payload.task_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (existing.status === "open") {
      return {
        events: [],
        outcomeStatus: "already_processed",
        reason: "Task already open",
      };
    }

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskReopened,
      command.payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private async loadState(): Promise<TasksLedgerState> {
    const state = initialState();
    for await (const event of this.eventStore.stream()) {
      reduceEvent(state, event as TaskEvent);
    }
    return state;
  }

  private buildEvent<TPayload>(
    command: CommandEnvelope<TaskCommandType, TaskCommandPayload>,
    eventType: TaskEvent["event_type"],
    payload: TPayload,
  ): EventEnvelope<TaskEventType, TPayload> {
    const timestamp = this.now();
    return {
      event_id: generateEventId({ eventType, payload }),
      event_type: eventType,
      payload,
      occurred_at: command.requested_at ?? timestamp,
      ingested_at: timestamp,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      source_ref: command.target_ref,
      actor: command.actor,
      capability_scope: [],
      schema_version: TASKS_SCHEMA_VERSION,
    };
  }
}

function isValidBucket(bucket: TaskBucket): boolean {
  return (
    bucket === "today" ||
    bucket === "week" ||
    bucket === "later" ||
    bucket === "waiting"
  );
}

function isValidImpact(impact: TaskImpact): boolean {
  return impact === "L" || impact === "M" || impact === "H";
}

function isValidEffort(effort: TaskEffort): boolean {
  return effort === "S" || effort === "M" || effort === "L";
}

export type { TaskState, TasksLedgerState };
export type {
  TaskCreatedPayload,
  TaskTriagedPayload,
  TaskCompletedPayload,
  TaskReopenedPayload,
} from "./events.js";
