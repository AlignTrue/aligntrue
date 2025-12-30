import type { EventEnvelope } from "@aligntrue/ops-core";
import type { ConversionMeta } from "@aligntrue/ops-core";
import { Contracts } from "@aligntrue/ops-core";

const {
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  TASK_BUCKETS,
  TASK_IMPACTS,
  TASK_EFFORTS,
  TASK_STATUSES,
} = Contracts;

export {
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  TASK_BUCKETS,
  TASK_IMPACTS,
  TASK_EFFORTS,
  TASK_STATUSES,
};
export const TASKS_SCHEMA_VERSION = 1;

export type TaskEventType =
  | (typeof TASK_EVENT_TYPES)[keyof typeof TASK_EVENT_TYPES]
  | (typeof LEGACY_TASK_EVENT_TYPES)[keyof typeof LEGACY_TASK_EVENT_TYPES];

export interface TaskCreatedPayload {
  task_id: string;
  title: string;
  bucket: (typeof TASK_BUCKETS)[number];
  status: (typeof TASK_STATUSES)[number];
  impact?: (typeof TASK_IMPACTS)[number];
  effort?: (typeof TASK_EFFORTS)[number];
  due_at?: string;
  source_ref?: string;
  conversion?: ConversionMeta;
}

export interface TaskTriagedPayload {
  task_id: string;
  bucket?: (typeof TASK_BUCKETS)[number];
  impact?: (typeof TASK_IMPACTS)[number];
  effort?: (typeof TASK_EFFORTS)[number];
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
