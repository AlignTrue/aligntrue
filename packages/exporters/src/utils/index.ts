/**
 * Shared utilities for exporters
 */

export {
  canonicalJson,
  globSpecificity,
  rulePriority,
  estimateRuleTokens,
  prioritizeRulesForCapExport,
  type TokenEstimate,
  type PrioritizationResult,
} from "./token-budget.js";

export {
  renderModeMarkers,
  extractMarkerPairs,
  type MarkerResult,
  type ExtractedMarker,
  type MarkerExtractionResult,
} from "./mode-markers.js";

export {
  extractModeConfig,
  applyRulePrioritization,
  generateSessionPreface,
  wrapRuleWithMarkers,
  shouldIncludeRule,
  type ModeHintsConfig,
} from "./mode-hints-helpers.js";
