import { isReady, type WorkLedgerState } from "../work-ledger/state-machine.js";

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
