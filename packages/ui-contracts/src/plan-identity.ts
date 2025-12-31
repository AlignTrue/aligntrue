import { canonicalize } from "./canonical.js";
import { deterministicId } from "./identity.js";
import type { PlanCore } from "./plan-core.js";

/**
 * Compute the canonical plan_id from the hashable PlanCore.
 * Excludes runtime metadata (timestamps, approvals).
 */
export function computePlanId(core: PlanCore): string {
  return deterministicId(canonicalize(core));
}
