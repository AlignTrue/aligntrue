import type { PackModule } from "@aligntrue/core";
import { manifest } from "./manifest.js";
import { commandHandlers } from "./commands.js";
import {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
} from "./projection.js";
import {
  TaskLedger,
  createJsonlTaskLedger,
  DEFAULT_TASKS_EVENTS_PATH,
  type TaskCommandEnvelope,
  type TaskCommandPayload,
  type TaskCommandType,
} from "./ledger.js";
import {
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  TASKS_SCHEMA_VERSION,
  type TaskCreatedPayload,
  type TaskTriagedPayload,
  type TaskCompletedPayload,
  type TaskReopenedPayload,
  type TaskEvent,
} from "./events.js";
import {
  TasksProjection,
  TasksProjectionState,
  TaskLatest,
} from "./projection.js";
import { Contracts } from "@aligntrue/core";

const moduleImpl: PackModule = {
  manifest,
  commandHandlers,
  projections: [TasksProjectionDef],
};

export default moduleImpl;
export { manifest } from "./manifest.js";
export { commandHandlers } from "./commands.js";
export {
  TaskLedger,
  createJsonlTaskLedger,
  DEFAULT_TASKS_EVENTS_PATH,
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  TASKS_SCHEMA_VERSION,
};
export {
  TasksProjection,
  TasksProjectionState,
  TaskLatest,
  TaskCommandEnvelope,
  TaskCommandPayload,
  TaskCommandType,
  TaskCreatedPayload,
  TaskTriagedPayload,
  TaskCompletedPayload,
  TaskReopenedPayload,
  TaskEvent,
};

// Re-export contracts for convenience
export const TASK_COMMAND_TYPES = Contracts.TASK_COMMAND_TYPES;
export const TASK_PROJECTION = Contracts.TASK_PROJECTION;
export const TASK_BUCKETS = Contracts.TASK_BUCKETS;
export const TASK_STATUSES = Contracts.TASK_STATUSES;
