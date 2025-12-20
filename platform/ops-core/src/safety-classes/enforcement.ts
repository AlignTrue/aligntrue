/**
 * Safety class enforcement boundary (stub) for side-effect gating.
 */
import { ActionIntent, ClassificationResult, SafetyClass } from "./types.js";

export function classifyIntent(intent: ActionIntent): ClassificationResult {
  return {
    safetyClass: intent.classification ?? SafetyClass.Read,
    requiresApproval:
      intent.classification === SafetyClass.WriteExternalSideEffect,
  };
}
