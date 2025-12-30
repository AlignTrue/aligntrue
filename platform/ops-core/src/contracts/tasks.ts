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

export const TASK_COMMAND_TYPES = {
  Create: "pack.tasks.create",
  Triage: "pack.tasks.triage",
  Complete: "pack.tasks.complete",
  Reopen: "pack.tasks.reopen",
} as const;

export const TASK_PROJECTION = "pack.tasks.latest" as const;
