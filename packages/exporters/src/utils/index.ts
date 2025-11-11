/**
 * Shared utilities for exporters
 */

// Section merging utilities
export * from "./section-parser.js";
export * from "./section-matcher.js";

// Legacy stub exports - utilities not yet implemented for sections format
export function canonicalJson(): unknown {
  throw new Error("canonicalJson not yet implemented");
}

export function globSpecificity(): unknown {
  throw new Error("globSpecificity not yet implemented");
}

export function rulePriority(): unknown {
  throw new Error("rulePriority not yet implemented");
}

export function estimateRuleTokens(): number {
  throw new Error("estimateRuleTokens not yet implemented");
}

export function prioritizeRulesForCapExport(): unknown {
  throw new Error("prioritizeRulesForCapExport not yet implemented");
}

export function renderModeMarkers(): unknown {
  throw new Error("renderModeMarkers not yet implemented");
}

export function extractMarkerPairs(): unknown {
  throw new Error("extractMarkerPairs not yet implemented");
}

export function extractModeConfig(): unknown {
  throw new Error("extractModeConfig not yet implemented");
}

export function applyRulePrioritization(): unknown {
  throw new Error("applyRulePrioritization not yet implemented");
}

export function generateSessionPreface(): string[] {
  return [];
}

export function wrapRuleWithMarkers(): string {
  throw new Error("wrapRuleWithMarkers not yet implemented");
}

export function shouldIncludeRule(): boolean {
  throw new Error("shouldIncludeRule not yet implemented");
}

// Stub types
export type TokenEstimate = unknown;
export type PrioritizationResult = unknown;
export type MarkerResult = unknown;
export type ExtractedMarker = unknown;
export type MarkerExtractionResult = unknown;
export type ModeHintsConfig = unknown;
