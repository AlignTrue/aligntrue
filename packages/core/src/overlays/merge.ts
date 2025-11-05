/**
 * Three-way merge algorithm for overlays (Phase 3.5, Session 4)
 * Merges upstream updates while preserving local overlays
 *
 * Algorithm: base + overlay + new_base → result
 * - base: Original upstream pack (before overlays)
 * - overlay: Local customizations applied
 * - new_base: Updated upstream pack
 * - result: Merged pack with overlays reapplied to new base
 *
 * Conflict detection categories:
 * - removed: Property was removed upstream but locally modified
 * - modified: Property was modified both upstream and locally (different values)
 * - moved: Property was moved upstream but locally modified
 */

import type { AlignPack } from "@aligntrue/schema";
import { deepClone } from "./operations.js";
import type { OverlayDefinition } from "./types.js";

/**
 * Conflict types detected during merge
 */
export type ConflictType = "removed" | "modified" | "moved" | "structural";

/**
 * Individual conflict detected during merge
 */
export interface MergeConflict {
  /** Type of conflict */
  type: ConflictType;
  /** Selector that caused conflict */
  selector: string;
  /** Property path within selected rule */
  propertyPath: string;
  /** Value in base (original upstream) */
  baseValue?: unknown;
  /** Value after local overlay */
  overlayValue?: unknown;
  /** Value in new upstream */
  newBaseValue?: unknown;
  /** Human-readable description */
  description: string;
  /** Suggested resolution */
  suggestion?: string;
}

/**
 * Result of three-way merge operation
 */
export interface MergeResult {
  /** Whether merge completed without conflicts */
  success: boolean;
  /** Merged IR (on success or auto-resolved) */
  mergedIR?: AlignPack;
  /** Conflicts detected (may have auto-resolutions) */
  conflicts: MergeConflict[];
  /** Auto-resolved conflicts (non-blocking) */
  autoResolved: MergeConflict[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
  /** Summary statistics */
  summary: {
    totalOverlays: number;
    appliedOverlays: number;
    conflictCount: number;
    autoResolvedCount: number;
  };
}

/**
 * Options for merge operation
 */
export interface MergeOptions {
  /** Auto-resolve strategy: "ours" (keep overlay), "theirs" (use upstream), "manual" (require user) */
  autoResolve?: "ours" | "theirs" | "manual";
  /** Skip validation (for internal use) */
  skipValidation?: boolean;
}

/**
 * Property change tracking for conflict detection
 */
interface PropertyChange {
  path: string[];
  oldValue: unknown;
  newValue: unknown;
  changeType: "added" | "removed" | "modified";
}

/**
 * Perform three-way merge of overlays
 *
 * @param base - Original upstream pack (before overlays)
 * @param overlays - Local overlay definitions
 * @param newBase - Updated upstream pack
 * @param options - Merge options
 * @returns Merge result with conflicts or merged IR
 */
export function threeWayMerge(
  base: AlignPack,
  overlays: OverlayDefinition[],
  newBase: AlignPack,
  options?: MergeOptions,
): MergeResult {
  const result: MergeResult = {
    success: true,
    conflicts: [],
    autoResolved: [],
    warnings: [],
    summary: {
      totalOverlays: overlays.length,
      appliedOverlays: 0,
      conflictCount: 0,
      autoResolvedCount: 0,
    },
  };

  // Start with new base as foundation
  let workingIR = deepClone(newBase);

  // Detect changes between base and newBase (upstream changes)
  const upstreamChanges = detectChanges(base, newBase);

  // Track conflicts per overlay
  for (const overlay of overlays) {
    const overlayConflicts = detectOverlayConflicts(
      overlay,
      base,
      newBase,
      upstreamChanges,
    );

    if (overlayConflicts.length > 0) {
      // Handle conflicts based on auto-resolve strategy
      const autoResolve = options?.autoResolve ?? "manual";

      if (autoResolve === "manual") {
        // Manual resolution required
        result.conflicts.push(...overlayConflicts);
        result.success = false;
      } else {
        // Auto-resolve conflicts
        result.autoResolved.push(...overlayConflicts);
        result.warnings.push(
          `Auto-resolved ${overlayConflicts.length} conflict(s) for overlay "${overlay.selector}" using strategy: ${autoResolve}`,
        );
      }
    }

    result.summary.appliedOverlays++;
  }

  result.summary.conflictCount = result.conflicts.length;
  result.summary.autoResolvedCount = result.autoResolved.length;

  // If no blocking conflicts, set merged IR
  if (result.success) {
    result.mergedIR = workingIR;
  }

  return result;
}

/**
 * Detect changes between two IR versions
 * Tracks property additions, removals, and modifications
 *
 * @param oldIR - Original IR
 * @param newIR - Updated IR
 * @returns Map of rule ID to property changes
 */
function detectChanges(
  oldIR: AlignPack,
  newIR: AlignPack,
): Map<string, PropertyChange[]> {
  const changes = new Map<string, PropertyChange[]>();

  // Compare rules by ID
  const oldRules = new Map(
    (oldIR.rules || []).map((r) => [r.id, r] as [string, AlignRule]),
  );
  const newRules = new Map(
    (newIR.rules || []).map((r) => [r.id, r] as [string, AlignRule]),
  );

  // Check all rule IDs (old + new)
  const allRuleIds = new Set([...oldRules.keys(), ...newRules.keys()]);

  for (const ruleId of allRuleIds) {
    const oldRule = oldRules.get(ruleId);
    const newRule = newRules.get(ruleId);
    const ruleChanges: PropertyChange[] = [];

    if (!oldRule && newRule) {
      // Rule added
      ruleChanges.push({
        path: [],
        oldValue: undefined,
        newValue: newRule,
        changeType: "added",
      });
    } else if (oldRule && !newRule) {
      // Rule removed
      ruleChanges.push({
        path: [],
        oldValue: oldRule,
        newValue: undefined,
        changeType: "removed",
      });
    } else if (oldRule && newRule) {
      // Rule exists in both - compare properties
      const propertyChanges = compareObjects(oldRule, newRule, []);
      ruleChanges.push(...propertyChanges);
    }

    if (ruleChanges.length > 0) {
      changes.set(ruleId, ruleChanges);
    }
  }

  return changes;
}

/**
 * Compare two objects and detect property changes
 * Recursively walks object tree
 *
 * @param oldObj - Original object
 * @param newObj - Updated object
 * @param path - Current property path
 * @returns Array of property changes
 */
function compareObjects(
  oldObj: unknown,
  newObj: unknown,
  path: string[],
): PropertyChange[] {
  const changes: PropertyChange[] = [];

  // Get all keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]);

  for (const key of allKeys) {
    const oldValue = oldObj?.[key];
    const newValue = newObj?.[key];
    const currentPath = [...path, key];

    if (oldValue === undefined && newValue !== undefined) {
      // Property added
      changes.push({
        path: currentPath,
        oldValue: undefined,
        newValue,
        changeType: "added",
      });
    } else if (oldValue !== undefined && newValue === undefined) {
      // Property removed
      changes.push({
        path: currentPath,
        oldValue,
        newValue: undefined,
        changeType: "removed",
      });
    } else if (oldValue !== newValue) {
      // Property modified
      if (
        typeof oldValue === "object" &&
        oldValue !== null &&
        typeof newValue === "object" &&
        newValue !== null
      ) {
        // Recurse into nested objects
        const nestedChanges = compareObjects(oldValue, newValue, currentPath);
        changes.push(...nestedChanges);
      } else {
        // Scalar value changed
        changes.push({
          path: currentPath,
          oldValue,
          newValue,
          changeType: "modified",
        });
      }
    }
  }

  return changes;
}

/**
 * Detect conflicts for a single overlay
 * Checks if overlay targets were changed upstream
 *
 * @param overlay - Overlay definition
 * @param base - Original upstream pack
 * @param newBase - Updated upstream pack
 * @param upstreamChanges - Map of upstream changes by rule ID
 * @returns Array of conflicts detected
 */
function detectOverlayConflicts(
  overlay: OverlayDefinition,
  base: AlignPack,
  newBase: AlignPack,
  upstreamChanges: Map<string, PropertyChange[]>,
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];

  // Extract rule ID from selector (simplified - assumes rule[id=...] format)
  const ruleIdMatch = overlay.selector.match(/rule\[id=([a-z0-9._-]+)\]/i);
  if (!ruleIdMatch) {
    // Non-rule selector - skip conflict detection for now
    return conflicts;
  }

  const ruleId = ruleIdMatch[1];
  if (!ruleId) return conflicts;

  const ruleChanges = upstreamChanges.get(ruleId);
  if (!ruleChanges || ruleChanges.length === 0) {
    // No upstream changes to this rule - no conflict
    return conflicts;
  }

  // Check if any overlay operations conflict with upstream changes
  const overlayProps = new Set<string>();

  // Collect overlay property paths
  if (overlay.set) {
    for (const key of Object.keys(overlay.set)) {
      overlayProps.add(key);
    }
  }
  if (overlay.remove) {
    for (const key of overlay.remove) {
      overlayProps.add(key);
    }
  }

  // Check each upstream change against overlay properties
  for (const change of ruleChanges) {
    const changePath = change.path.join(".");

    // Check if this change affects an overlaid property
    for (const overlayProp of overlayProps) {
      if (
        changePath === overlayProp ||
        changePath.startsWith(overlayProp + ".") ||
        overlayProp.startsWith(changePath + ".")
      ) {
        // Conflict detected - determine type
        let conflictType: ConflictType = "modified";
        let description = "";
        let suggestion = "";

        if (change.changeType === "removed") {
          conflictType = "removed";
          description = `Property "${changePath}" was removed upstream but is modified by overlay`;
          suggestion = `Remove overlay or update selector to target different property`;
        } else if (change.changeType === "modified") {
          conflictType = "modified";
          description = `Property "${changePath}" was modified upstream and locally`;
          suggestion = `Review upstream change and update overlay if needed`;
        } else if (change.changeType === "added") {
          // Property added upstream - usually not a conflict unless overlay also adds it
          continue;
        }

        conflicts.push({
          type: conflictType,
          selector: overlay.selector,
          propertyPath: changePath,
          baseValue: change.oldValue,
          overlayValue: overlay.set?.[overlayProp],
          newBaseValue: change.newValue,
          description,
          suggestion,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Generate patch file content for conflicts
 * Creates human-readable diff format
 *
 * @param conflicts - Array of merge conflicts
 * @param metadata - Patch metadata
 * @returns Patch file content
 */
export function generatePatchFile(
  conflicts: MergeConflict[],
  metadata: {
    baseHash: string;
    newBaseHash: string;
    timestamp: string;
    source?: string;
  },
): string {
  const lines: string[] = [];

  // Header
  lines.push("# AlignTrue Overlay Merge Conflicts");
  lines.push(`# Generated: ${metadata.timestamp}`);
  lines.push(`# Base: ${metadata.baseHash.slice(0, 8)}`);
  lines.push(`# Updated: ${metadata.newBaseHash.slice(0, 8)}`);
  if (metadata.source) {
    lines.push(`# Source: ${metadata.source}`);
  }
  lines.push("");
  lines.push("# This file documents conflicts detected during overlay merge.");
  lines.push(
    "# Review each conflict and update your overlays in .aligntrue/config.yaml",
  );
  lines.push("");

  // Group conflicts by selector
  const bySelector = new Map<string, MergeConflict[]>();
  for (const conflict of conflicts) {
    const existing = bySelector.get(conflict.selector) || [];
    existing.push(conflict);
    bySelector.set(conflict.selector, existing);
  }

  // Write conflicts per selector
  for (const [selector, selectorConflicts] of bySelector) {
    lines.push(`## Selector: ${selector}`);
    lines.push("");

    for (const conflict of selectorConflicts) {
      lines.push(
        `### ${conflict.type.toUpperCase()}: ${conflict.propertyPath}`,
      );
      lines.push("");
      lines.push(conflict.description);
      if (conflict.suggestion) {
        lines.push(`**Suggestion:** ${conflict.suggestion}`);
      }
      lines.push("");

      // Show values
      lines.push("```yaml");
      lines.push("# Base (original upstream):");
      lines.push(
        `base: ${conflict.baseValue !== undefined ? JSON.stringify(conflict.baseValue, null, 2) : "undefined"}`,
      );
      lines.push("");
      lines.push("# Overlay (your customization):");
      lines.push(
        `overlay: ${conflict.overlayValue !== undefined ? JSON.stringify(conflict.overlayValue, null, 2) : "undefined"}`,
      );
      lines.push("");
      lines.push("# New base (updated upstream):");
      lines.push(
        `new_base: ${conflict.newBaseValue !== undefined ? JSON.stringify(conflict.newBaseValue, null, 2) : "undefined"}`,
      );
      lines.push("```");
      lines.push("");
    }
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("## Resolution Steps");
  lines.push("");
  lines.push("1. Review conflicts above");
  lines.push("2. Update overlays in `.aligntrue/config.yaml`:");
  lines.push("   - Remove overlays that are no longer needed");
  lines.push("   - Update selectors if properties moved");
  lines.push("   - Adjust values to match upstream changes");
  lines.push("3. Re-run `aln update` to apply changes");
  lines.push("4. Delete this patch file once resolved");
  lines.push("");

  return lines.join("\n");
}
