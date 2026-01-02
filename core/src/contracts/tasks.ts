/**
 * Task domain contracts.
 * Types and constants only - no implementation.
 */

export type TaskBucket = "today" | "week" | "later" | "waiting";
export const TASK_BUCKETS: TaskBucket[] = ["today", "week", "later", "waiting"];

export type TaskStatus = "open" | "completed";
export const TASK_STATUSES: TaskStatus[] = ["open", "completed"];

export type TaskImpact = "L" | "M" | "H";
export const TASK_IMPACTS: TaskImpact[] = ["L", "M", "H"];

export type TaskEffort = "S" | "M" | "L";
export const TASK_EFFORTS: TaskEffort[] = ["S", "M", "L"];

export const TASK_EVENT_TYPES = {
  TaskCreated: "pack.tasks.task_created",
  TaskTriaged: "pack.tasks.task_triaged",
  TaskCompleted: "pack.tasks.task_completed",
  TaskReopened: "pack.tasks.task_reopened",
} as const;

/**
 * Legacy event types used before namespacing.
 * Supported for backward compatibility during projection rebuilds.
 */
export const LEGACY_TASK_EVENT_TYPES = {
  TaskCreated: "task_created",
  TaskTriaged: "task_triaged",
  TaskCompleted: "task_completed",
  TaskReopened: "task_reopened",
} as const;

export const TASK_COMMAND_TYPES = {
  Create: "pack.tasks.create",
  Triage: "pack.tasks.triage",
  Complete: "pack.tasks.complete",
  Reopen: "pack.tasks.reopen",
} as const;

export const TASK_PROJECTION = "pack.tasks.latest" as const;

// Payload contracts
export interface TaskCreatedPayload {
  task_id: string;
  title: string;
  bucket: TaskBucket;
  status: TaskStatus;
  impact?: TaskImpact;
  effort?: TaskEffort;
  due_at?: string;
  source_ref?: string;
  conversion?: import("../types/conversion.js").ConversionMeta;
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
