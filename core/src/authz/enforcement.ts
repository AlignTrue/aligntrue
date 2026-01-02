/**
 * DR-007 RowField-Auth-Projection-Strategy enforcement boundary (stub).
 * No-op implementations allow callers to plug in future auth logic without runtime changes today.
 */
import { AuthzContext, AuthzDecision, RowPolicy } from "./types.js";

export interface RedactionResult<T> {
  row: T;
  decision: AuthzDecision;
}

export function enforceRowPolicy<T>(_input: {
  row: T;
  policy: RowPolicy;
  context: AuthzContext;
}): AuthzDecision {
  return { allowed: true, redactedFields: [] };
}

export function redactFields<T>(input: {
  row: T;
  policy: RowPolicy;
  context: AuthzContext;
}): RedactionResult<T> {
  return { row: input.row, decision: { allowed: true, redactedFields: [] } };
}
