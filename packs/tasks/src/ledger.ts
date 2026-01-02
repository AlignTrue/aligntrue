import { join } from "node:path";
import {
  ValidationError,
  PreconditionFailed,
  Storage,
  Contracts,
  OPS_DATA_DIR,
  BaseLedger,
} from "@aligntrue/core";
import type { CommandEnvelope, CommandOutcome } from "@aligntrue/core";
import {
  TASK_EVENT_TYPES,
  TASKS_SCHEMA_VERSION,
  type TaskEvent,
  type TaskCreatedPayload,
  type TaskTriagedPayload,
  type TaskCompletedPayload,
  type TaskReopenedPayload,
} from "./events.js";
import {
  initialState,
  reduceEvent,
  type TasksLedgerState,
} from "./state-machine.js";

const { TASK_COMMAND_TYPES, TASK_BUCKETS, TASK_IMPACTS, TASK_EFFORTS } =
  Contracts;

export type TaskCommandType =
  (typeof TASK_COMMAND_TYPES)[keyof typeof TASK_COMMAND_TYPES];

type TaskCommandEnvelopes = {
  [TASK_COMMAND_TYPES.Create]: CommandEnvelope<
    typeof TASK_COMMAND_TYPES.Create,
    TaskCreatedPayload
  >;
  [TASK_COMMAND_TYPES.Triage]: CommandEnvelope<
    typeof TASK_COMMAND_TYPES.Triage,
    TaskTriagedPayload
  >;
  [TASK_COMMAND_TYPES.Complete]: CommandEnvelope<
    typeof TASK_COMMAND_TYPES.Complete,
    TaskCompletedPayload
  >;
  [TASK_COMMAND_TYPES.Reopen]: CommandEnvelope<
    typeof TASK_COMMAND_TYPES.Reopen,
    TaskReopenedPayload
  >;
};

export type TaskCommandEnvelope<T extends TaskCommandType = TaskCommandType> =
  TaskCommandEnvelopes[T];

export type TaskCommandPayload = TaskCommandEnvelope["payload"];

export const DEFAULT_TASKS_EVENTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-tasks-events.jsonl",
);

export function createJsonlTaskLedger(opts?: {
  eventsPath?: string;
  commandsPath?: string;
  outcomesPath?: string;
  allowExternalPaths?: boolean;
  now?: () => string;
}) {
  const eventStore = new Storage.JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_TASKS_EVENTS_PATH,
  );
  const commandLog = new Storage.JsonlCommandLog(
    opts?.commandsPath ?? join(OPS_DATA_DIR, "ops-core-tasks-commands.jsonl"),
    opts?.outcomesPath ?? join(OPS_DATA_DIR, "ops-core-tasks-outcomes.jsonl"),
    { allowExternalPaths: opts?.allowExternalPaths },
  );
  return new TaskLedger(eventStore, commandLog, opts);
}

export class TaskLedger extends BaseLedger<
  TasksLedgerState,
  TaskCommandEnvelope,
  TaskEvent
> {
  constructor(
    eventStore: Storage.EventStore,
    commandLog: Storage.CommandLog,
    opts?: { now?: () => string },
  ) {
    super(eventStore, commandLog, opts);
  }

  protected override initialState(): TasksLedgerState {
    return initialState();
  }

  protected override reduceEvent(
    state: TasksLedgerState,
    event: TaskEvent,
  ): TasksLedgerState {
    return reduceEvent(state, event);
  }

  protected override envelopeVersion(): number {
    return 1;
  }

  protected override payloadSchemaVersion(): number {
    return TASKS_SCHEMA_VERSION;
  }

  protected override applyCommand(
    command: TaskCommandEnvelope,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    switch (command.command_type) {
      case TASK_COMMAND_TYPES.Create:
        return this.handleCreate(command, state);
      case TASK_COMMAND_TYPES.Triage:
        return this.handleTriage(command, state);
      case TASK_COMMAND_TYPES.Complete:
        return this.handleComplete(command, state);
      case TASK_COMMAND_TYPES.Reopen:
        return this.handleReopen(command, state);
      default: {
        const type = (command as CommandEnvelope).command_type;
        throw new ValidationError(`Unsupported command type: ${type}`);
      }
    }
  }

  private handleCreate(
    command: TaskCommandEnvelope<typeof TASK_COMMAND_TYPES.Create>,
    state: TasksLedgerState,
  ): { events: TaskEvent[] } {
    if (state.tasks.has(command.payload.task_id)) {
      throw new PreconditionFailed("missing", "exists");
    }

    const { bucket, impact, effort } = command.payload;
    if (bucket && !TASK_BUCKETS.includes(bucket)) {
      throw new ValidationError(`Invalid bucket: ${bucket}`);
    }
    if (impact && !TASK_IMPACTS.includes(impact)) {
      throw new ValidationError(`Invalid impact: ${impact}`);
    }
    if (effort && !TASK_EFFORTS.includes(effort)) {
      throw new ValidationError(`Invalid effort: ${effort}`);
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
    command: TaskCommandEnvelope<typeof TASK_COMMAND_TYPES.Triage>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const payload = command.payload;
    const existing = state.tasks.get(payload.task_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }

    const { bucket, impact, effort } = payload;
    if (bucket && !TASK_BUCKETS.includes(bucket)) {
      throw new ValidationError(`Invalid bucket: ${bucket}`);
    }
    if (impact && !TASK_IMPACTS.includes(impact)) {
      throw new ValidationError(`Invalid impact: ${impact}`);
    }
    if (effort && !TASK_EFFORTS.includes(effort)) {
      throw new ValidationError(`Invalid effort: ${effort}`);
    }

    const hasChange =
      payload.bucket !== undefined ||
      payload.impact !== undefined ||
      payload.effort !== undefined ||
      payload.due_at !== undefined ||
      payload.title !== undefined;

    if (!hasChange) {
      return { events: [], outcomeStatus: "already_processed" };
    }

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskTriaged,
      payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleComplete(
    command: TaskCommandEnvelope<typeof TASK_COMMAND_TYPES.Complete>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const payload = command.payload;
    const existing = state.tasks.get(payload.task_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (existing.status === "completed") {
      return { events: [], outcomeStatus: "already_processed" };
    }

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskCompleted,
      payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }

  private handleReopen(
    command: TaskCommandEnvelope<typeof TASK_COMMAND_TYPES.Reopen>,
    state: TasksLedgerState,
  ): {
    events: TaskEvent[];
    reason?: string;
    outcomeStatus?: CommandOutcome["status"];
  } {
    const payload = command.payload;
    const existing = state.tasks.get(payload.task_id);
    if (!existing) {
      throw new PreconditionFailed("exists", "missing");
    }
    if (existing.status === "open") {
      return { events: [], outcomeStatus: "already_processed" };
    }

    const event = this.buildEvent(
      command,
      TASK_EVENT_TYPES.TaskReopened,
      payload,
    ) as TaskEvent;
    reduceEvent(state, event);
    return { events: [event] };
  }
}
