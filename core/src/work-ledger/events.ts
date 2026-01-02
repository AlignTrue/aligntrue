import type { EventEnvelope } from "../envelopes/index.js";

export const WORK_LEDGER_SCHEMA_VERSION = 1;

export const WORK_EVENT_TYPES = {
  WorkItemCreated: "work_item_created",
  WorkItemUpdated: "work_item_updated",
  WorkItemCompleted: "work_item_completed",
  WorkItemBlocked: "work_item_blocked",
  WorkItemUnblocked: "work_item_unblocked",
  DependencyAdded: "work_dependency_added",
  DependencyRemoved: "work_dependency_removed",
} as const;

export type WorkLedgerEventType =
  (typeof WORK_EVENT_TYPES)[keyof typeof WORK_EVENT_TYPES];

export interface WorkItemCreatedPayload {
  work_id: string;
  title: string;
  description?: string;
}

export interface WorkItemUpdatedPayload {
  work_id: string;
  title?: string;
  description?: string;
  status?: WorkStatus;
}

export interface WorkItemCompletedPayload {
  work_id: string;
}

export interface WorkItemBlockedPayload {
  work_id: string;
  reason?: string;
}

export interface WorkItemUnblockedPayload {
  work_id: string;
}

export interface DependencyAddedPayload {
  work_id: string;
  depends_on: string;
}

export interface DependencyRemovedPayload {
  work_id: string;
  depends_on: string;
}

export type WorkStatus = "pending" | "in_progress" | "completed";

export type WorkLedgerEvent =
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.WorkItemCreated,
      WorkItemCreatedPayload
    >
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.WorkItemUpdated,
      WorkItemUpdatedPayload
    >
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.WorkItemCompleted,
      WorkItemCompletedPayload
    >
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.WorkItemBlocked,
      WorkItemBlockedPayload
    >
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.WorkItemUnblocked,
      WorkItemUnblockedPayload
    >
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.DependencyAdded,
      DependencyAddedPayload
    >
  | EventEnvelope<
      typeof WORK_EVENT_TYPES.DependencyRemoved,
      DependencyRemovedPayload
    >;
