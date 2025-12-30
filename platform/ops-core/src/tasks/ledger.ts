import { PreconditionFailed, ValidationError } from "../errors.js";
import { Identity } from "../identity/index.js";
import type {
  CommandEnvelope,
  CommandOutcome,
  EventEnvelope,
} from "../envelopes/index.js";
import type { CommandLog, EventStore } from "../storage/interfaces.js";
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
import { TASK_COMMAND_TYPES } from "../contracts/tasks.js";
import { join } from "node:path";
import { OPS_DATA_DIR } from "../config.js";
import { JsonlCommandLog } from "../storage/jsonl-command-log.js";
import { JsonlEventStore } from "../storage/jsonl-event-store.js";

const TASKS_ENVELOPE_VERSION = 1;

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
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_TASKS_EVENTS_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath ?? join(OPS_DATA_DIR, "ops-core-tasks-commands.jsonl"),
    opts?.outcomesPath ?? join(OPS_DATA_DIR, "ops-core-tasks-outcomes.jsonl"),
    { allowExternalPaths: opts?.allowExternalPaths },
  );
  return new TaskLedger(eventStore, commandLog, opts);
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

  async execute(command: TaskCommandEnvelope): Promise<CommandOutcome> {
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

  private async loadState(): Promise<TasksLedgerState> {
    const state = initialState();
    for await (const event of this.eventStore.stream()) {
      reduceEvent(state, event as TaskEvent);
    }
    return state;
  }

  private buildEvent<TPayload>(
    command: TaskCommandEnvelope,
    eventType: TaskEvent["event_type"],
    payload: TPayload,
  ): EventEnvelope<string, TPayload> {
    const timestamp = this.now();
    const capability_id = command.capability_id ?? command.command_type;
    return {
      event_id: Identity.generateEventId({ eventType, payload }),
      event_type: eventType,
      payload,
      occurred_at: command.requested_at ?? timestamp,
      ingested_at: timestamp,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      causation_type: "command",
      actor: command.actor,
      ...(command.target_ref !== undefined
        ? { source_ref: command.target_ref }
        : {}),
      ...(capability_id !== undefined ? { capability_id } : {}),
      envelope_version: TASKS_ENVELOPE_VERSION,
      payload_schema_version: TASKS_SCHEMA_VERSION,
    };
  }
}
