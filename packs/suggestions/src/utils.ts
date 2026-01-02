import { OPS_SUGGESTIONS_ENABLED, ValidationError } from "@aligntrue/core";

export function ensureSuggestionsEnabled(): void {
  if (!OPS_SUGGESTIONS_ENABLED) {
    throw new ValidationError(
      "Suggestions are disabled (OPS_SUGGESTIONS_ENABLED=0)",
    );
  }
}
