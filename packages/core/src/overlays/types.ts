/**
 * Types for overlay system (Overlays system)
 * Enables declarative customization of upstream rules without forking
 */

/**
 * Selector types for targeting rules in IR
 * Deterministic subset: no wildcards, no computed functions, no regex
 */
export type SelectorType =
  | "rule"
  | "property"
  | "array_index"
  | "section_heading";

/**
 * Parsed selector components
 */
export interface ParsedSelector {
  type: SelectorType;
  /** For rule selectors: rule[id=value] */
  ruleId?: string;
  /** For section heading selectors: sections[heading=value] */
  heading?: string;
  /** For property selectors: path.to.property */
  propertyPath?: string[];
  /** For array selectors: array[0] */
  arrayIndex?: number;
}

/**
 * Operations that can be applied via overlays
 */
export type OverlayOperation = "set" | "remove";

/**
 * Set operation: deep property updates
 */
export interface SetOperation {
  type: "set";
  /** Key-value pairs to set, supports nested paths with dot notation */
  values: Record<string, unknown>;
}

/**
 * Remove operation: property deletion
 */
export interface RemoveOperation {
  type: "remove";
  /** Keys to remove, supports nested paths with dot notation */
  keys: string[];
}

/**
 * Single overlay definition in config
 */
export interface OverlayDefinition {
  /** Deterministic selector string */
  selector: string;
  /** Set operation (optional) */
  set?: Record<string, unknown>;
  /** Remove operation (optional) */
  remove?: string[];
}

/**
 * Overlay configuration section
 */
export interface OverlayConfig {
  /** List of overlay definitions */
  overrides?: OverlayDefinition[];
  /** Size limits (optional, defaults applied) */
  limits?: {
    max_overrides?: number;
    max_operations_per_override?: number;
  };
}

/**
 * Result of selector evaluation against IR
 */
export interface SelectorMatch {
  /** Whether selector matched exactly one target */
  success: boolean;
  /** Matched target path in IR (for success) */
  targetPath?: string[];
  /** Matched target value */
  targetValue?: unknown;
  /** Error message (for failure) */
  error?: string;
  /** Number of matches found (for debugging) */
  matchCount?: number;
}

/**
 * Result of overlay application
 */
export interface OverlayApplicationResult {
  /** Whether application succeeded */
  success: boolean;
  /** Modified IR (on success) */
  modifiedIR?: unknown;
  /** Errors encountered */
  errors?: string[];
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** Applied overlays count */
  appliedCount?: number;
}

/**
 * Overlay validation result
 */
export interface OverlayValidationResult {
  valid: boolean;
  errors?: OverlayValidationError[];
  warnings?: OverlayValidationWarning[];
}

/**
 * Overlay validation error
 */
export interface OverlayValidationError {
  selector: string;
  type: "stale" | "ambiguous" | "invalid_syntax" | "size_limit";
  message: string;
  suggestion?: string;
}

/**
 * Overlay validation warning
 */
export interface OverlayValidationWarning {
  selector: string;
  type: "plug_conflict" | "approaching_limit" | "redundant";
  message: string;
}

/**
 * Triple-hash format for overlays in lockfile
 */
export interface OverlayHashes {
  /** Hash of base pack (upstream) */
  base_hash: string;
  /** Hash of overlay configuration */
  overlay_hash: string;
  /** Hash of result after applying overlays */
  result_hash: string;
}

/**
 * Default limits for overlay configuration
 */
export const DEFAULT_OVERLAY_LIMITS = {
  max_overrides: 50,
  max_operations_per_override: 20,
} as const;
