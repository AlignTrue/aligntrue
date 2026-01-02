import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
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

export interface WorkItemsProjectionState extends ProjectionFreshness {
  ledger: WorkLedgerState;
}

export const WorkItemsProjectionDef: ProjectionDefinition<WorkItemsProjectionState> =
  {
    name: "work_items",
    version: "1.0.0",
    init(): WorkItemsProjectionState {
      return {
        ledger: initialState(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: WorkItemsProjectionState,
      event: WorkLedgerEvent,
    ): WorkItemsProjectionState {
      const ledger = cloneState(state.ledger);
      reduceEvent(ledger, event);
      return {
        ledger,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    },
    getFreshness(state: WorkItemsProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildWorkItemsProjectionFromState(
  state: WorkItemsProjectionState,
): WorkItemsProjection {
  return buildWorkItemsProjection(state.ledger);
}

export async function replayWorkItems(
  events: AsyncIterable<WorkLedgerEvent>,
): Promise<WorkItemsProjection> {
  let state: WorkItemsProjectionState = WorkItemsProjectionDef.init();
  for await (const event of events) {
    state = WorkItemsProjectionDef.apply(state, event);
  }
  return buildWorkItemsProjectionFromState(state);
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
