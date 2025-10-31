/**
 * Overlay validation rules for CI gates (Phase 3.5, Session 5)
 * Validates overlays against IR to detect stale selectors, ambiguous matches,
 * plug conflicts, and size limit violations
 */

import type { AlignPack } from "@aligntrue/schema";
import { evaluateSelector } from "./selector-engine.js";
import type {
  OverlayDefinition,
  OverlayValidationResult,
  OverlayValidationError,
  OverlayValidationWarning,
} from "./types.js";

/**
 * Validate overlays against IR and configuration
 * Checks for stale selectors, ambiguous matches, plug conflicts, and size limits
 *
 * @param overlays - Array of overlay definitions to validate
 * @param ir - AlignPack IR to validate against
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 */
export function validateOverlays(
  overlays: OverlayDefinition[],
  ir: AlignPack,
  options?: {
    /** Maximum number of overlays allowed (default: 50) */
    maxOverrides?: number;
    /** Maximum operations per override (default: 20) */
    maxOperationsPerOverride?: number;
    /** Detect plug conflicts (default: true) */
    detectPlugConflicts?: boolean;
  },
): OverlayValidationResult {
  const errors: OverlayValidationError[] = [];
  const warnings: OverlayValidationWarning[] = [];

  const maxOverrides = options?.maxOverrides ?? 50;
  const maxOpsPerOverride = options?.maxOperationsPerOverride ?? 20;
  const detectPlugConflicts = options?.detectPlugConflicts ?? true;

  // Validate each overlay (do selector validation first)
  for (const overlay of overlays) {
    // Check stale selectors (no matches in current IR)
    const staleResult = checkStaleSelector(overlay, ir);
    if (staleResult) {
      errors.push(staleResult);
      continue; // Skip further checks if selector is stale
    }

    // Check ambiguous selectors (multiple matches)
    const ambiguousResult = checkAmbiguousSelector(overlay, ir);
    if (ambiguousResult) {
      errors.push(ambiguousResult);
      continue; // Skip further checks if selector is ambiguous
    }

    // Check plug conflicts (overlay redefines plug-provided keys)
    if (detectPlugConflicts) {
      const plugConflictResult = checkPlugConflicts(overlay, ir);
      if (plugConflictResult) {
        warnings.push(plugConflictResult);
      }
    }
  }

  // Validate size limits after selector checks
  validateSizeLimits(
    overlays,
    maxOverrides,
    maxOpsPerOverride,
    errors,
    warnings,
  );

  const result: OverlayValidationResult = {
    valid: errors.length === 0,
  };
  if (errors.length > 0) {
    result.errors = errors;
  }
  if (warnings.length > 0) {
    result.warnings = warnings;
  }
  return result;
}

/**
 * Check if selector is stale (no matches in current IR)
 *
 * @param overlay - Overlay definition
 * @param ir - AlignPack IR
 * @returns Error if stale, undefined otherwise
 */
function checkStaleSelector(
  overlay: OverlayDefinition,
  ir: AlignPack,
): OverlayValidationError | undefined {
  const result = evaluateSelector(overlay.selector, ir);

  if (!result.success && result.matchCount === 0) {
    return {
      selector: overlay.selector,
      type: "stale",
      message: `Selector does not match any target in current IR: ${result.error || "no matches found"}`,
      suggestion:
        "Update or remove this overlay. The upstream rule may have been renamed or removed.",
    };
  }

  return undefined;
}

/**
 * Check if selector is ambiguous (multiple matches)
 *
 * @param overlay - Overlay definition
 * @param ir - AlignPack IR
 * @returns Error if ambiguous, undefined otherwise
 */
function checkAmbiguousSelector(
  overlay: OverlayDefinition,
  ir: AlignPack,
): OverlayValidationError | undefined {
  const result = evaluateSelector(overlay.selector, ir);

  if (!result.success && result.matchCount && result.matchCount > 1) {
    return {
      selector: overlay.selector,
      type: "ambiguous",
      message: `Selector matches ${result.matchCount} targets (expected exactly 1)`,
      suggestion:
        "Make the selector more specific to target a single rule or property.",
    };
  }

  return undefined;
}

/**
 * Check for plug conflicts (overlay redefines plug-provided keys)
 * Plug keys are identified by the presence of "plugs" in the rule
 *
 * @param overlay - Overlay definition
 * @param ir - AlignPack IR
 * @returns Warning if conflicts detected, undefined otherwise
 */
function checkPlugConflicts(
  overlay: OverlayDefinition,
  ir: AlignPack,
): OverlayValidationWarning | undefined {
  // Only check rule selectors (property and array selectors don't have plugs)
  if (!overlay.selector.startsWith("rule[id=")) {
    return undefined;
  }

  const result = evaluateSelector(overlay.selector, ir);
  if (!result.success || !result.targetValue) {
    return undefined;
  }

  const rule = result.targetValue as any;

  // Check if rule has plugs
  if (!rule.plugs || !Array.isArray(rule.plugs) || rule.plugs.length === 0) {
    return undefined;
  }

  // Extract plug slot names from plugs array
  const plugSlots = new Set<string>();
  for (const plug of rule.plugs) {
    if (plug && typeof plug === "object" && "slot" in plug) {
      plugSlots.add(String(plug.slot));
    }
  }

  if (plugSlots.size === 0) {
    return undefined;
  }

  // Check if overlay modifies plug-provided keys
  const conflicts: string[] = [];

  if (overlay.set) {
    for (const key of Object.keys(overlay.set)) {
      if (plugSlots.has(key)) {
        conflicts.push(key);
      }
    }
  }

  if (overlay.remove) {
    for (const key of overlay.remove) {
      if (plugSlots.has(key)) {
        conflicts.push(key);
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      selector: overlay.selector,
      type: "plug_conflict",
      message: `Overlay modifies plug-provided keys: ${conflicts.join(", ")}. The plug's values will be overridden by this overlay.`,
    };
  }

  return undefined;
}

/**
 * Validate size limits (overlay count and operations per overlay)
 *
 * @param overlays - Array of overlay definitions
 * @param maxOverrides - Maximum overlays allowed
 * @param maxOpsPerOverride - Maximum operations per overlay
 * @param errors - Array to append errors to
 * @param warnings - Array to append warnings to
 */
function validateSizeLimits(
  overlays: OverlayDefinition[],
  maxOverrides: number,
  maxOpsPerOverride: number,
  errors: OverlayValidationError[],
  warnings: OverlayValidationWarning[],
): void {
  // Check total overlay count
  if (overlays.length > maxOverrides) {
    errors.push({
      selector: "(global)",
      type: "size_limit",
      message: `Too many overlays: ${overlays.length} exceeds limit of ${maxOverrides}`,
      suggestion:
        "Consider splitting overlays across multiple configs or simplifying customizations.",
    });
  }

  // Warn at 80% threshold
  const threshold = Math.floor(maxOverrides * 0.8);
  if (overlays.length > threshold && overlays.length <= maxOverrides) {
    warnings.push({
      selector: "(global)",
      type: "approaching_limit",
      message: `Approaching overlay limit: ${overlays.length}/${maxOverrides} (${Math.round((overlays.length / maxOverrides) * 100)}%)`,
    });
  }

  // Check operations per overlay
  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    if (!overlay) continue;

    const setCount = overlay.set ? Object.keys(overlay.set).length : 0;
    const removeCount = overlay.remove ? overlay.remove.length : 0;
    const totalOps = setCount + removeCount;

    if (totalOps > maxOpsPerOverride) {
      errors.push({
        selector: overlay.selector,
        type: "size_limit",
        message: `Overlay has ${totalOps} operations (limit: ${maxOpsPerOverride})`,
        suggestion: "Split this overlay into multiple smaller overlays.",
      });
    }

    // Warn at 80% threshold
    const opsThreshold = Math.floor(maxOpsPerOverride * 0.8);
    if (totalOps > opsThreshold && totalOps <= maxOpsPerOverride) {
      warnings.push({
        selector: overlay.selector,
        type: "approaching_limit",
        message: `Overlay approaching operations limit: ${totalOps}/${maxOpsPerOverride} (${Math.round((totalOps / maxOpsPerOverride) * 100)}%)`,
      });
    }
  }
}

/**
 * Detect redundant overlays (no actual changes)
 * An overlay is redundant if all its set operations match existing values
 * and all its remove operations target non-existent keys
 *
 * @param overlays - Array of overlay definitions
 * @param ir - AlignPack IR
 * @returns Array of warnings for redundant overlays
 */
export function detectRedundantOverlays(
  overlays: OverlayDefinition[],
  ir: AlignPack,
): OverlayValidationWarning[] {
  const warnings: OverlayValidationWarning[] = [];

  for (const overlay of overlays) {
    const result = evaluateSelector(overlay.selector, ir);
    if (!result.success || !result.targetValue) {
      continue; // Skip if selector doesn't match
    }

    const target = result.targetValue as any;
    let hasChanges = false;

    // Check set operations
    if (overlay.set) {
      for (const [key, value] of Object.entries(overlay.set)) {
        if (!(key in target) || target[key] !== value) {
          hasChanges = true;
          break;
        }
      }
    }

    // Check remove operations (only if no changes from set)
    if (!hasChanges && overlay.remove) {
      for (const key of overlay.remove) {
        if (key in target) {
          hasChanges = true;
          break;
        }
      }
    }

    if (!hasChanges) {
      warnings.push({
        selector: overlay.selector,
        type: "redundant",
        message:
          "Overlay has no effect (all set values match existing, all remove keys are absent)",
      });
    }
  }

  return warnings;
}

/**
 * Quick validation check for CI gates
 * Returns true if overlays are valid (no errors), false otherwise
 *
 * @param overlays - Array of overlay definitions
 * @param ir - AlignPack IR
 * @param options - Validation options
 * @returns True if valid, false if errors detected
 */
export function areOverlaysValid(
  overlays: OverlayDefinition[],
  ir: AlignPack,
  options?: {
    maxOverrides?: number;
    maxOperationsPerOverride?: number;
    detectPlugConflicts?: boolean;
  },
): boolean {
  const result = validateOverlays(overlays, ir, options);
  return result.valid;
}

/**
 * Format validation result for CLI output
 * Returns formatted string with errors and warnings
 *
 * @param result - Validation result
 * @returns Formatted string
 */
export function formatOverlayValidationResult(
  result: OverlayValidationResult,
): string {
  const lines: string[] = [];

  if (result.errors && result.errors.length > 0) {
    lines.push("Errors:");
    for (const error of result.errors) {
      lines.push(`  ✗ [${error.type}] ${error.selector}`);
      lines.push(`    ${error.message}`);
      if (error.suggestion) {
        lines.push(`    Suggestion: ${error.suggestion}`);
      }
    }
  }

  if (result.warnings && result.warnings.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  ⚠ [${warning.type}] ${warning.selector}`);
      lines.push(`    ${warning.message}`);
    }
  }

  return lines.join("\n");
}
