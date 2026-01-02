import { hashCanonical } from "../identity/hash.js";

export interface PolicyContent {
  surfaces_by_intent: Record<string, string[]>;
}

/**
 * Normalize policy content deterministically:
 * - sort intent keys
 * - sort + dedupe surface arrays
 */
export function normalizePolicyContent(content: PolicyContent): PolicyContent {
  const normalized: Record<string, string[]> = {};
  const intents = Object.keys(content.surfaces_by_intent).sort();
  for (const intent of intents) {
    const surfaces = content.surfaces_by_intent[intent] ?? [];
    normalized[intent] = Array.from(new Set(surfaces)).sort();
  }
  return { surfaces_by_intent: normalized };
}

/**
 * Compute content-addressed policy id from normalized content.
 */
export function computePolicyId(content: PolicyContent): string {
  return hashCanonical(normalizePolicyContent(content));
}

export const POLICY_COMMAND_TYPES = {
  Set: "policy.set",
} as const;

export const POLICY_EVENT_TYPES = {
  Upserted: "policy.upserted",
} as const;

export interface PolicySetPayload {
  policy_id: string;
  scope: { user_id: string };
  content: PolicyContent;
  expected_previous_policy_id?: string | undefined;
}

export interface PolicyUpsertedPayload {
  policy_id: string;
  scope: { user_id: string };
  content: PolicyContent;
  previous_policy_id?: string | undefined;
}
