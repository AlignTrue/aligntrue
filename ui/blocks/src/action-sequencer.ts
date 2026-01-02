import type { BlockAction } from "@aligntrue/ui-contracts";

export type SequenceDecision = "accept" | "duplicate" | "reject_stale";

export interface ActionSequenceState {
  readonly plan_id: string;
  readonly actor_id: string;
  readonly processed_keys: Set<string>;
  readonly last_processed_sequence: number;
}

export const DEFAULT_MAX_GAP = 10;

export function validateSequence(
  action: BlockAction,
  state: ActionSequenceState,
  maxGap: number = DEFAULT_MAX_GAP,
): SequenceDecision {
  if (state.processed_keys.has(action.idempotency_key)) {
    return "duplicate";
  }

  if (action.client_sequence <= state.last_processed_sequence) {
    return "reject_stale";
  }

  if (action.client_sequence > state.last_processed_sequence + maxGap) {
    return "reject_stale";
  }

  return "accept";
}

export function applySequence(
  action: BlockAction,
  state: ActionSequenceState,
  decision: SequenceDecision,
): ActionSequenceState {
  if (decision === "reject_stale") return state;

  const nextProcessed = new Set(state.processed_keys);
  if (decision === "accept") {
    nextProcessed.add(action.idempotency_key);
    return {
      ...state,
      processed_keys: nextProcessed,
      last_processed_sequence: action.client_sequence,
    };
  }

  // duplicate
  return state;
}

export function createSequenceState(
  plan_id: string,
  actor_id: string,
  last_processed_sequence = 0,
  processed_keys: Set<string> = new Set(),
): ActionSequenceState {
  return { plan_id, actor_id, last_processed_sequence, processed_keys };
}
