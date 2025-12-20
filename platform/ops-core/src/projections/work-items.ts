import type { WorkLedgerEvent } from "../work-ledger/events.js";
import {
  cloneState,
  initialState,
  reduceEvent,
  type WorkLedgerState,
  type WorkStatus,
} from "../work-ledger/state-machine.js";

export interface WorkItemView {
  id: string;
  title: string;
  description?: string | undefined;
  status: WorkStatus;
  blocked: boolean;
  blocked_reason?: string | undefined;
  dependencies: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkItemsProjection {
  items: Record<string, WorkItemView>;
}

export function buildWorkItemsProjection(
  state: WorkLedgerState,
): WorkItemsProjection {
  const items: Record<string, WorkItemView> = {};
  const sortedIds = Array.from(state.items.keys()).sort();
  for (const id of sortedIds) {
    const item = state.items.get(id);
    if (!item) continue;
    items[id] = {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      blocked: item.blocked,
      blocked_reason: item.blocked_reason,
      dependencies: Array.from(item.dependencies).sort(),
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }
  return { items };
}

export async function replayWorkItems(
  events: AsyncIterable<WorkLedgerEvent>,
): Promise<WorkItemsProjection> {
  const state = initialState();
  for await (const event of events) {
    reduceEvent(state, event);
  }
  return buildWorkItemsProjection(state);
}

export function projectAfterEvent(
  state: WorkLedgerState,
  event: WorkLedgerEvent,
): { state: WorkLedgerState; projection: WorkItemsProjection } {
  const nextState = cloneState(state);
  reduceEvent(nextState, event);
  return {
    state: nextState,
    projection: buildWorkItemsProjection(nextState),
  };
}
