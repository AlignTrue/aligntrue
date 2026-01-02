import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import {
  cloneState,
  initialState,
  reduceEvent,
  isReady,
  type WorkLedgerState,
} from "../work-ledger/state-machine.js";
import type { WorkLedgerEvent } from "../work-ledger/events.js";

export interface ReadyQueueProjection {
  ready: string[];
}

export function buildReadyQueueProjection(
  state: WorkLedgerState,
): ReadyQueueProjection {
  const ready = Array.from(state.items.values())
    .filter((item) => isReady(item, state))
    .map((item) => item.id)
    .sort();

  return { ready };
}

export interface ReadyQueueProjectionState extends ProjectionFreshness {
  ledger: WorkLedgerState;
}

export const ReadyQueueProjectionDef: ProjectionDefinition<ReadyQueueProjectionState> =
  {
    name: "ready_queue",
    version: "1.0.0",
    init(): ReadyQueueProjectionState {
      return {
        ledger: initialState(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ReadyQueueProjectionState,
      event: WorkLedgerEvent,
    ): ReadyQueueProjectionState {
      const ledger = cloneState(state.ledger);
      reduceEvent(ledger, event);
      return {
        ledger,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    },
    getFreshness(state: ReadyQueueProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildReadyQueueProjectionFromState(
  state: ReadyQueueProjectionState,
): ReadyQueueProjection {
  return buildReadyQueueProjection(state.ledger);
}
