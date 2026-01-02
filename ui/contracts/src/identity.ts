import { canonicalize } from "./canonical.js";
import { hashSync } from "./hash.js";

/**
 * Browser-safe deterministic ID from any value.
 * Uses canonical JSON + simple hash for client-side use.
 */
export function deterministicId(value: unknown): string {
  return hashSync(canonicalize(value));
}
