import {
  WORK_EVENT_TYPES,
  type WorkLedgerEvent,
  type WorkStatus,
} from "./events.js";
import { cloneMapWith, cloneSet } from "../utils/collections.js";

export interface WorkItemState {
  id: string;
  title: string;
  description?: string | undefined;
  status: WorkStatus;
  blocked: boolean;
  blocked_reason?: string | undefined;
  dependencies: Set<string>;
  created_at: string;
  updated_at: string;
}

export interface WorkLedgerState {
  items: Map<string, WorkItemState>;
}

export function initialState(): WorkLedgerState {
  return { items: new Map() };
}

export function reduceEvent(
  state: WorkLedgerState,
  event: WorkLedgerEvent,
): WorkLedgerState {
  const next = state;
  switch (event.event_type) {
    case WORK_EVENT_TYPES.WorkItemCreated: {
      const { work_id, title, description } = event.payload;
      next.items.set(work_id, {
        id: work_id,
        title,
        description,
        status: "pending",
        blocked: false,
        dependencies: new Set(),
        created_at: event.occurred_at,
        updated_at: event.ingested_at,
      });
      break;
    }
    case WORK_EVENT_TYPES.WorkItemUpdated: {
      const { work_id, title, description, status } = event.payload;
      const existing = next.items.get(work_id);
      if (!existing) break;
      if (title !== undefined) existing.title = title;
      if (description !== undefined) existing.description = description;
      if (status !== undefined) existing.status = status;
      existing.updated_at = event.ingested_at;
      break;
    }
    case WORK_EVENT_TYPES.WorkItemCompleted: {
      const { work_id } = event.payload;
      const existing = next.items.get(work_id);
      if (!existing) break;
      existing.status = "completed";
      existing.updated_at = event.ingested_at;
      break;
    }
    case WORK_EVENT_TYPES.WorkItemBlocked: {
      const { work_id, reason } = event.payload;
      const existing = next.items.get(work_id);
      if (!existing) break;
      existing.blocked = true;
      existing.blocked_reason = reason;
      existing.updated_at = event.ingested_at;
      break;
    }
    case WORK_EVENT_TYPES.WorkItemUnblocked: {
      const { work_id } = event.payload;
      const existing = next.items.get(work_id);
      if (!existing) break;
      existing.blocked = false;
      existing.blocked_reason = undefined;
      existing.updated_at = event.ingested_at;
      break;
    }
    case WORK_EVENT_TYPES.DependencyAdded: {
      const { work_id, depends_on } = event.payload;
      const existing = next.items.get(work_id);
      if (!existing) break;
      existing.dependencies.add(depends_on);
      existing.updated_at = event.ingested_at;
      break;
    }
    case WORK_EVENT_TYPES.DependencyRemoved: {
      const { work_id, depends_on } = event.payload;
      const existing = next.items.get(work_id);
      if (!existing) break;
      existing.dependencies.delete(depends_on);
      existing.updated_at = event.ingested_at;
      break;
    }
    default:
      break;
  }
  return next;
}

export function cloneState(state: WorkLedgerState): WorkLedgerState {
  const items = cloneMapWith(state.items, (item) => ({
    ...item,
    dependencies: cloneSet(item.dependencies),
  }));
  return { items };
}

export function isReady(item: WorkItemState, state: WorkLedgerState): boolean {
  if (item.status === "completed") return false;
  if (item.blocked) return false;
  for (const dep of item.dependencies) {
    const blocker = state.items.get(dep);
    if (!blocker) return false;
    if (blocker.status !== "completed") return false;
  }
  return true;
}

export type { WorkStatus };
