import type { EventEnvelope } from "../envelopes/index.js";
import type { ConversionMeta } from "../types/conversion.js";
import type {
  TaskBucket,
  TaskEffort,
  TaskImpact,
  TaskStatus,
} from "./types.js";

export const TASKS_SCHEMA_VERSION = 1;

export const TASK_EVENT_TYPES = {
  TaskCreated: "task_created",
  TaskTriaged: "task_triaged",
  TaskCompleted: "task_completed",
  TaskReopened: "task_reopened",
} as const;

export type TaskEventType =
  (typeof TASK_EVENT_TYPES)[keyof typeof TASK_EVENT_TYPES];

export interface TaskCreatedPayload {
  task_id: string;
  title: string;
  bucket: TaskBucket;
  status: TaskStatus;
  impact?: TaskImpact;
  effort?: TaskEffort;
  due_at?: string;
  source_ref?: string;
  conversion?: ConversionMeta;
}

export interface TaskTriagedPayload {
  task_id: string;
  bucket?: TaskBucket;
  impact?: TaskImpact;
  effort?: TaskEffort;
  due_at?: string | null;
  title?: string;
}

export interface TaskCompletedPayload {
  task_id: string;
}

export interface TaskReopenedPayload {
  task_id: string;
}

export type TaskEvent =
  | EventEnvelope<typeof TASK_EVENT_TYPES.TaskCreated, TaskCreatedPayload>
  | EventEnvelope<typeof TASK_EVENT_TYPES.TaskTriaged, TaskTriagedPayload>
  | EventEnvelope<typeof TASK_EVENT_TYPES.TaskCompleted, TaskCompletedPayload>
  | EventEnvelope<typeof TASK_EVENT_TYPES.TaskReopened, TaskReopenedPayload>;
