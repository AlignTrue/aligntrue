/**
 * Mode markers
 * @deprecated Not implemented for sections-only format
 *
 * The natural markdown sections format does not include mode hints or intelligent mode.
 * This module is kept as a stub to prevent import errors in legacy code paths.
 * Tests for this module have been removed.
 */

// Stub implementations for backward compatibility
export function renderModeMarkers(): { prefix: string; suffix: string } {
  return { prefix: "", suffix: "" };
}

export function extractMarkerPairs(): {
  valid: Array<{ id: string; begin: number; end: number }>;
  errors: string[];
} {
  return { valid: [], errors: [] };
}

export function wrapRuleWithMarkers(): string {
  throw new Error("wrapRuleWithMarkers not implemented for sections format");
}

export function shouldIncludeRule(): boolean {
  throw new Error("shouldIncludeRule not implemented for sections format");
}
