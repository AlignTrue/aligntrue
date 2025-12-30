import {
  PreconditionFailed,
  Identity,
  type CommandEnvelope,
  type CommandOutcome,
  type EventEnvelope,
  type PackCommandHandler,
  type EventStore,
  type PackContext,
} from "@aligntrue/ops-core";
import {
  TASKS_SCHEMA_VERSION,
  TASK_COMMAND_TYPES,
  TASK_EVENT_TYPES,
  type TaskCompletedPayload,
  type TaskCreatedPayload,
  type TaskEvent,
  type TaskReopenedPayload,
  type TaskTriagedPayload,
} from "./events.js";
import {
  initialState,
  reduceEvent,
  type TasksLedgerState,
} from "./state-machine.js";
import type { TaskBucket, TaskEffort, TaskImpact } from "./types.js";

const TASKS_ENVELOPE_VERSION = 1;

export const commandHandlers: Record<string, PackCommandHandler> = {
  [TASK_COMMAND_TYPES.Create]: handleCreate,
  [TASK_COMMAND_TYPES.Triage]: handleTriage,
  [TASK_COMMAND_TYPES.Complete]: handleComplete,
  [TASK_COMMAND_TYPES.Reopen]: handleReopen,
};

async function handleCreate(
  command: CommandEnvelope,
  context: PackContext,
): Promise<CommandOutcome> {
  const state = await loadState(context.eventStore);
  if (state.tasks.has((command.payload as TaskCreatedPayload).task_id)) {
    throw new PreconditionFailed("missing", "exists");
  }

  const payload: TaskCreatedPayload = {
    ...(command.payload as TaskCreatedPayload),
    bucket: (command.payload as TaskCreatedPayload).bucket ?? "today",
    status: "open",
  };

  const event = buildEvent(
    command,
    TASK_EVENT_TYPES.TaskCreated,
    payload,
  ) as TaskEvent;
  reduceEvent(state, event);
  await context.eventStore.append(event);

  return {
    command_id: command.command_id,
    status: "accepted",
    produced_events: [event.event_id],
    completed_at: new Date().toISOString(),
  };
}

async function handleTriage(
  command: CommandEnvelope,
  context: PackContext,
): Promise<CommandOutcome> {
  const state = await loadState(context.eventStore);
  const payload = command.payload as TaskTriagedPayload;
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
    return {
      command_id: command.command_id,
      status: "already_processed",
      reason: "No changes provided",
      produced_events: [],
      completed_at: new Date().toISOString(),
    };
  }

  if (payload.bucket && !isValidBucket(payload.bucket)) {
    throw new PreconditionFailed("valid_bucket", payload.bucket);
  }
  if (payload.impact && !isValidImpact(payload.impact)) {
    throw new PreconditionFailed("impact_L_M_H", payload.impact);
  }
  if (payload.effort && !isValidEffort(payload.effort)) {
    throw new PreconditionFailed("effort_S_M_L", payload.effort);
  }

  const event = buildEvent(
    command,
    TASK_EVENT_TYPES.TaskTriaged,
    payload,
  ) as TaskEvent;
  reduceEvent(state, event);
  await context.eventStore.append(event);

  return {
    command_id: command.command_id,
    status: "accepted",
    produced_events: [event.event_id],
    completed_at: new Date().toISOString(),
  };
}

async function handleComplete(
  command: CommandEnvelope,
  context: PackContext,
): Promise<CommandOutcome> {
  const state = await loadState(context.eventStore);
  const payload = command.payload as TaskCompletedPayload;
  const existing = state.tasks.get(payload.task_id);
  if (!existing) {
    throw new PreconditionFailed("exists", "missing");
  }
  if (existing.status === "completed") {
    return {
      command_id: command.command_id,
      status: "already_processed",
      reason: "Task already completed",
      produced_events: [],
      completed_at: new Date().toISOString(),
    };
  }

  const event = buildEvent(
    command,
    TASK_EVENT_TYPES.TaskCompleted,
    payload,
  ) as TaskEvent;
  reduceEvent(state, event);
  await context.eventStore.append(event);

  return {
    command_id: command.command_id,
    status: "accepted",
    produced_events: [event.event_id],
    completed_at: new Date().toISOString(),
  };
}

async function handleReopen(
  command: CommandEnvelope,
  context: PackContext,
): Promise<CommandOutcome> {
  const state = await loadState(context.eventStore);
  const payload = command.payload as TaskReopenedPayload;
  const existing = state.tasks.get(payload.task_id);
  if (!existing) {
    throw new PreconditionFailed("exists", "missing");
  }
  if (existing.status === "open") {
    return {
      command_id: command.command_id,
      status: "already_processed",
      reason: "Task already open",
      produced_events: [],
      completed_at: new Date().toISOString(),
    };
  }

  const event = buildEvent(
    command,
    TASK_EVENT_TYPES.TaskReopened,
    payload,
  ) as TaskEvent;
  reduceEvent(state, event);
  await context.eventStore.append(event);

  return {
    command_id: command.command_id,
    status: "accepted",
    produced_events: [event.event_id],
    completed_at: new Date().toISOString(),
  };
}

async function loadState(eventStore: EventStore): Promise<TasksLedgerState> {
  const state = initialState();
  for await (const event of eventStore.stream()) {
    reduceEvent(state, event as TaskEvent);
  }
  return state;
}

function buildEvent<TPayload>(
  command: CommandEnvelope,
  eventType: TaskEvent["event_type"],
  payload: TPayload,
): EventEnvelope<TaskEvent["event_type"], TPayload> {
  const timestamp = new Date().toISOString();
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
