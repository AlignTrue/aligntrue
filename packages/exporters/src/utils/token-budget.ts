/**
 * Token budget calculator
 * @deprecated Not implemented for sections-only format
 *
 * Token budget and rule prioritization are features of the legacy rules format.
 * The natural markdown sections format focuses on clarity and authorship quality
 * rather than token optimization. This module is kept as a stub to prevent
 * import errors in legacy code paths. Tests for this module have been removed.
 */

// Stub implementations for backward compatibility
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj);
}

export function globSpecificity(pattern: string): number {
  return pattern.length;
}

export function rulePriority(): number {
  return 0;
}

export function estimateRuleTokens(): number {
  return 0;
}

export function prioritizeRulesForCapExport(): Array<Record<string, unknown>> {
  return [];
}

export function calculateBudget(): unknown {
  throw new Error("calculateBudget not implemented for sections format");
}

export function estimateTokens(): number {
  throw new Error("estimateTokens not implemented for sections format");
}
