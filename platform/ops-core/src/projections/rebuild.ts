import { hashCanonical } from "../identity/hash.js";
import type { EventStore } from "../storage/interfaces.js";
import type { WorkLedgerEvent } from "../work-ledger/events.js";
import {
  initialState,
  reduceEvent,
  type WorkLedgerState,
} from "../work-ledger/state-machine.js";
import { buildReadyQueueProjection } from "./ready-queue.js";
import { buildWorkItemsProjection } from "./work-items.js";

export interface WorkLedgerProjections {
  workItems: ReturnType<typeof buildWorkItemsProjection>;
  readyQueue: ReturnType<typeof buildReadyQueueProjection>;
  hash: string;
}

export async function rebuildWorkLedger(
  eventStore: EventStore,
): Promise<WorkLedgerProjections> {
  const state = await replayState(eventStore);
  const workItems = buildWorkItemsProjection(state);
  const readyQueue = buildReadyQueueProjection(state);
  const hash = hashCanonical({ workItems, readyQueue });
  return { workItems, readyQueue, hash };
}

async function replayState(eventStore: EventStore): Promise<WorkLedgerState> {
  const state = initialState();
  for await (const event of eventStore.stream()) {
    reduceEvent(state, event as WorkLedgerEvent);
  }
  return state;
}
