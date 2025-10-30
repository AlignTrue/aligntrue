/**
 * Overlay application algorithm (Phase 3.5)
 * Applies overlays to IR in deterministic order
 */

import type { AlignPack } from "@aligntrue/schema";
import { evaluateSelector } from "./selector-engine.js";
import { compareSelectors } from "./selector-parser.js";
import {
  setProperty,
  removeProperty,
  applySetOperations,
  applyRemoveOperations,
  deepClone,
} from "./operations.js";
import type {
  OverlayDefinition,
  OverlayApplicationResult,
  DEFAULT_OVERLAY_LIMITS,
} from "./types.js";

/**
 * Apply overlays to an AlignPack IR
 * Applies in deterministic order:
 * 1. File order (order in config)
 * 2. Stable sort by selector
 * 3. Set operations before remove operations
 *
 * @param ir - Base IR to modify
 * @param overlays - Array of overlay definitions
 * @param options - Application options
 * @returns Result with modified IR or errors
 */
export function applyOverlays(
  ir: AlignPack,
  overlays: OverlayDefinition[],
  options?: {
    /** Maximum number of overlays allowed */
    maxOverrides?: number;
    /** Maximum operations per override (set + remove combined) */
    maxOperationsPerOverride?: number;
  },
): OverlayApplicationResult {
  // Deep clone IR to avoid mutations
  const modifiedIR = deepClone(ir);

  const errors: string[] = [];
  const warnings: string[] = [];
  let appliedCount = 0;

  // Enforce size limits
  const maxOverrides = options?.maxOverrides ?? 50;
  const maxOpsPerOverride = options?.maxOperationsPerOverride ?? 20;

  if (overlays.length > maxOverrides) {
    return {
      success: false,
      errors: [
        `Too many overlays: ${overlays.length} exceeds limit of ${maxOverrides}`,
      ],
    };
  }

  // Sort overlays for deterministic application
  const sortedOverlays = sortOverlays(overlays);

  // Apply each overlay
  for (const overlay of sortedOverlays) {
    try {
      // Check operations count
      const setCount = overlay.set ? Object.keys(overlay.set).length : 0;
      const removeCount = overlay.remove ? overlay.remove.length : 0;
      const totalOps = setCount + removeCount;

      if (totalOps > maxOpsPerOverride) {
        errors.push(
          `Overlay "${overlay.selector}" has ${totalOps} operations (limit: ${maxOpsPerOverride})`,
        );
        continue;
      }

      // Evaluate selector against current IR
      const selectorResult = evaluateSelector(overlay.selector, modifiedIR);

      if (!selectorResult.success) {
        errors.push(
          `Selector "${overlay.selector}" failed: ${selectorResult.error}`,
        );
        continue;
      }

      // Get target from IR
      const target = getTargetFromPath(modifiedIR, selectorResult.targetPath!);

      if (!target) {
        errors.push(
          `Selector "${overlay.selector}" resolved to undefined target`,
        );
        continue;
      }

      // Apply set operations
      if (overlay.set && Object.keys(overlay.set).length > 0) {
        applySetOperations(target, overlay.set);
      }

      // Apply remove operations
      if (overlay.remove && overlay.remove.length > 0) {
        applyRemoveOperations(target, overlay.remove);
      }

      appliedCount++;
    } catch (err) {
      errors.push(
        `Error applying overlay "${overlay.selector}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Check for conflicts (multiple overlays targeting same property)
  detectConflicts(sortedOverlays, warnings);

  if (errors.length > 0) {
    const result: OverlayApplicationResult = {
      success: false,
      errors,
    };
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    return result;
  }

  const result: OverlayApplicationResult = {
    success: true,
    modifiedIR,
    appliedCount,
  };
  if (warnings.length > 0) {
    result.warnings = warnings;
  }
  return result;
}

/**
 * Sort overlays for deterministic application
 * Order: file order preserved, then stable sort by selector
 *
 * @param overlays - Array of overlay definitions
 * @returns Sorted array (new array, doesn't mutate input)
 */
function sortOverlays(overlays: OverlayDefinition[]): OverlayDefinition[] {
  // Create array with original indices for stable sort
  const indexed = overlays.map((overlay, index) => ({ overlay, index }));

  // Sort by selector, preserving file order for equal selectors
  indexed.sort((a, b) => {
    const selectorCompare = compareSelectors(
      a.overlay.selector,
      b.overlay.selector,
    );
    if (selectorCompare !== 0) {
      return selectorCompare;
    }
    // Preserve file order for equal selectors (stable sort)
    return a.index - b.index;
  });

  return indexed.map((item) => item.overlay);
}

/**
 * Get target object from IR given a path
 *
 * @param ir - AlignPack IR
 * @param path - Property path array (e.g., ["rules", "0"])
 * @returns Target object or undefined
 */
function getTargetFromPath(ir: any, path: string[]): any {
  let current = ir;
  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Detect conflicts between overlays
 * Warns when multiple overlays target overlapping properties
 *
 * @param overlays - Sorted array of overlays
 * @param warnings - Array to append warnings to
 */
function detectConflicts(
  overlays: OverlayDefinition[],
  warnings: string[],
): void {
  // Track which selector+property combinations are modified
  const modifications = new Map<string, string[]>(); // selector -> properties modified

  for (const overlay of overlays) {
    const properties: string[] = [];

    // Collect set properties
    if (overlay.set) {
      properties.push(...Object.keys(overlay.set));
    }

    // Collect remove properties
    if (overlay.remove) {
      properties.push(...overlay.remove);
    }

    // Check for conflicts with previous overlays
    for (const [prevSelector, prevProps] of modifications.entries()) {
      if (prevSelector === overlay.selector) {
        // Same selector - check for property overlap
        const overlap = properties.filter((p) => prevProps.includes(p));
        if (overlap.length > 0) {
          warnings.push(
            `Multiple overlays modify same properties on "${overlay.selector}": ${overlap.join(", ")} (last wins)`,
          );
        }
      }
    }

    // Record modifications
    if (!modifications.has(overlay.selector)) {
      modifications.set(overlay.selector, []);
    }
    modifications.get(overlay.selector)!.push(...properties);
  }
}

/**
 * Normalize IR line endings before hashing
 * Ensures LF endings with single trailing LF
 *
 * @param ir - AlignPack IR
 * @returns Normalized IR (new object)
 */
export function normalizeLineEndings(ir: AlignPack): AlignPack {
  const normalized = deepClone(ir);

  // Recursively normalize string properties
  function normalize(obj: any): void {
    if (typeof obj === "string") {
      return; // Can't mutate strings, caller must handle
    }

    if (Array.isArray(obj)) {
      obj.forEach(normalize);
      return;
    }

    if (typeof obj === "object" && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          // Normalize line endings: CRLF -> LF, ensure single trailing LF
          let str = obj[key].replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          // Trim trailing newlines then add exactly one
          str = str.replace(/\n+$/, "") + "\n";
          obj[key] = str;
        } else {
          normalize(obj[key]);
        }
      }
    }
  }

  normalize(normalized);
  return normalized;
}

/**
 * Check if overlays would exceed size limits
 *
 * @param overlays - Array of overlay definitions
 * @param limits - Size limits
 * @returns Validation result with errors
 */
export function validateOverlaySizeLimits(
  overlays: OverlayDefinition[],
  limits?: { maxOverrides?: number; maxOperationsPerOverride?: number },
): { valid: boolean; errors?: string[] } {
  const maxOverrides = limits?.maxOverrides ?? 50;
  const maxOpsPerOverride = limits?.maxOperationsPerOverride ?? 20;

  const errors: string[] = [];

  if (overlays.length > maxOverrides) {
    errors.push(
      `Too many overlays: ${overlays.length} exceeds limit of ${maxOverrides}`,
    );
  }

  // Warn at 80% threshold
  if (overlays.length > maxOverrides * 0.8) {
    errors.push(
      `Approaching overlay limit: ${overlays.length}/${maxOverrides} (consider splitting or simplifying)`,
    );
  }

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    if (!overlay) continue;
    const setCount = overlay.set ? Object.keys(overlay.set).length : 0;
    const removeCount = overlay.remove ? overlay.remove.length : 0;
    const totalOps = setCount + removeCount;

    if (totalOps > maxOpsPerOverride) {
      errors.push(
        `Overlay #${i + 1} "${overlay.selector}" has ${totalOps} operations (limit: ${maxOpsPerOverride})`,
      );
    }
  }

  const result: { valid: boolean; errors?: string[] } = {
    valid: errors.length === 0,
  };
  if (errors.length > 0) {
    result.errors = errors;
  }
  return result;
}
