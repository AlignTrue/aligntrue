import { canonicalize } from "./canonical.js";
import { deterministicId } from "./identity.js";

/**
 * Compute an idempotency key for an action given plan, type, and sequence.
 */
export function computeActionIdempotencyKey(params: {
  plan_id: string;
  action_type: string;
  client_sequence: number;
}): string {
  return deterministicId(
    canonicalize({
      plan_id: params.plan_id,
      action_type: params.action_type,
      client_sequence: params.client_sequence,
    }),
  );
}
