import type { EventEnvelope } from "../envelopes/event.js";
import type { ConversionMeta } from "../types/conversion.js";
import {
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  type TaskBucket,
  type TaskEffort,
  type TaskImpact,
  type TaskStatus,
} from "../contracts/tasks.js";

export { TASK_EVENT_TYPES, LEGACY_TASK_EVENT_TYPES };
export const TASKS_SCHEMA_VERSION = 1;

export type TaskEventType =
  | (typeof TASK_EVENT_TYPES)[keyof typeof TASK_EVENT_TYPES]
  | (typeof LEGACY_TASK_EVENT_TYPES)[keyof typeof LEGACY_TASK_EVENT_TYPES];

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
  | EventEnvelope<
      (typeof TASK_EVENT_TYPES)["TaskCreated"] | "task_created",
      TaskCreatedPayload
    >
  | EventEnvelope<
      (typeof TASK_EVENT_TYPES)["TaskTriaged"] | "task_triaged",
      TaskTriagedPayload
    >
  | EventEnvelope<
      (typeof TASK_EVENT_TYPES)["TaskCompleted"] | "task_completed",
      TaskCompletedPayload
    >
  | EventEnvelope<
      (typeof TASK_EVENT_TYPES)["TaskReopened"] | "task_reopened",
      TaskReopenedPayload
    >;
