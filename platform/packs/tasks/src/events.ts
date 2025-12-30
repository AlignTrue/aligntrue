import {
  Contracts,
  type EventEnvelope,
  type ConversionMeta,
} from "@aligntrue/ops-core";
import type {
  TaskBucket,
  TaskEffort,
  TaskImpact,
  TaskStatus,
} from "./types.js";

export const { TASK_COMMAND_TYPES, TASK_EVENT_TYPES, TASK_PROJECTION } =
  Contracts;

export const TASKS_SCHEMA_VERSION = 1;

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
  | EventEnvelope<(typeof TASK_EVENT_TYPES)["TaskCreated"], TaskCreatedPayload>
  | EventEnvelope<(typeof TASK_EVENT_TYPES)["TaskTriaged"], TaskTriagedPayload>
  | EventEnvelope<
      (typeof TASK_EVENT_TYPES)["TaskCompleted"],
      TaskCompletedPayload
    >
  | EventEnvelope<
      (typeof TASK_EVENT_TYPES)["TaskReopened"],
      TaskReopenedPayload
    >;
