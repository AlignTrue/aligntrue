/**
 * Bundle merging - combine multiple AlignAligns into a single align
 *
 * Merge strategy:
 * - Sections with same fingerprint: first source wins (with warning)
 * - Metadata: merge with last-wins precedence
 * - Plugs: merge fills, validate no slot conflicts
 * - Scopes: union of all scopes
 */

import type { Align, AlignSection } from "@aligntrue/schema";
import { ensureSectionsArray } from "./validation/sections.js";

export interface BundleOptions {
  /**
   * Whether to warn about conflicting rules (default: true)
   */
  warnConflicts?: boolean;

  /**
   * Bundle ID for the merged align (default: "merged-bundle")
   */
  bundleId?: string;

  /**
   * Bundle version (default: "1.0.0")
   */
  bundleVersion?: string;
}

export interface BundleResult {
  /**
   * Merged Align
   */
  align: Align;

  /**
   * Conflicts detected during merge
   */
  conflicts: Array<{
    fingerprint: string;
    sources: string[]; // Which sources had this section
    resolution: string; // Which source won
  }>;

  /**
   * Warnings generated during merge
   */
  warnings: string[];
}

/**
 * Merge multiple AlignAligns into a single bundle
 *
 * @param aligns - Array of AlignAligns to merge (in precedence order)
 * @param options - Merge options
 * @returns Merged align with conflict information
 */
export function mergeAligns(
  aligns: Align[],
  options?: BundleOptions,
): BundleResult {
  if (aligns.length === 0) {
    throw new Error("Cannot merge empty align array");
  }

  // Handle single align case
  const singleAlignResult = handleSingleAlign(aligns);
  if (singleAlignResult) {
    return singleAlignResult;
  }

  // Extract options
  const warnConflicts = options?.warnConflicts ?? true;
  const bundleId = options?.bundleId ?? "merged-bundle";
  const bundleVersion = options?.bundleVersion ?? "1.0.0";

  // Initialize merge state
  const conflicts: BundleResult["conflicts"] = [];
  const warnings: string[] = [];

  // Merge sections with conflict detection
  const mergedSections = mergeSections(
    aligns,
    conflicts,
    warnings,
    warnConflicts,
  );

  // Merge other align components
  const mergedPlugs = mergePlugs(aligns, warnings);
  const mergedScope = mergeScopes(aligns);
  const mergedTags = mergeTags(aligns);
  const mergedDeps = mergeDeps(aligns);

  // Assemble final align
  const lastAlign = aligns[aligns.length - 1];
  if (!lastAlign) {
    throw new Error("Last align is undefined");
  }

  const mergedAlign = assembleMergedAlign(
    bundleId,
    bundleVersion,
    mergedSections,
    lastAlign,
    mergedPlugs,
    mergedScope,
    mergedTags,
    mergedDeps,
  );

  return {
    align: mergedAlign,
    conflicts,
    warnings,
  };
}

/**
 * Handle single align case with deterministic sorting
 */
function handleSingleAlign(aligns: Align[]): BundleResult | null {
  if (aligns.length !== 1) {
    return null;
  }

  const align = aligns[0];
  if (!align) {
    throw new Error("First align is undefined");
  }

  // Defensive: Initialize sections to empty array if missing
  ensureSectionsArray(align);

  // Sort sections by fingerprint for determinism if align has sections
  if (align.sections.length > 1) {
    const sortedSections = [...align.sections].sort((a, b) =>
      a.fingerprint.localeCompare(b.fingerprint),
    );
    return {
      align: { ...align, sections: sortedSections },
      conflicts: [],
      warnings: [],
    };
  }

  return {
    align,
    conflicts: [],
    warnings: [],
  };
}

/**
 * Merge sections from multiple aligns with conflict detection
 */
function mergeSections(
  aligns: Align[],
  conflicts: BundleResult["conflicts"],
  warnings: string[],
  warnConflicts: boolean,
): AlignSection[] {
  const sectionMap = new Map<
    string,
    {
      section: AlignSection;
      source: string;
      sourceIndex: number;
    }
  >();

  for (let i = 0; i < aligns.length; i++) {
    const align = aligns[i];
    if (!align) continue;

    // Defensive: Initialize sections to empty array if missing
    ensureSectionsArray(align);

    const sourceName = align.id || `source-${i}`;

    for (const section of align.sections) {
      const existing = sectionMap.get(section.fingerprint);

      if (existing) {
        // Conflict detected - first source wins (not last)
        conflicts.push({
          fingerprint: section.fingerprint,
          sources: [existing.source, sourceName],
          resolution: existing.source,
        });

        if (warnConflicts) {
          warnings.push(
            `Section conflict: "${section.heading}" (${section.fingerprint}) defined in both "${existing.source}" and "${sourceName}". Using "${existing.source}" (higher priority).`,
          );
        }

        // Skip this section - first source already set it
        continue;
      }

      // First source wins - only set if not already present
      sectionMap.set(section.fingerprint, {
        section,
        source: sourceName,
        sourceIndex: i,
      });
    }
  }

  // Extract merged sections (sorted by fingerprint for determinism)
  return Array.from(sectionMap.values())
    .sort((a, b) => a.section.fingerprint.localeCompare(b.section.fingerprint))
    .map((entry) => entry.section);
}

/**
 * Assemble final merged align from components
 */
function assembleMergedAlign(
  bundleId: string,
  bundleVersion: string,
  mergedSections: AlignSection[],
  lastAlign: Align,
  mergedPlugs: Align["plugs"] | undefined,
  mergedScope: Align["scope"] | undefined,
  mergedTags: string[],
  mergedDeps: string[],
): Align {
  // Build base align
  const mergedAlign: Align = {
    id: bundleId,
    version: bundleVersion,
    spec_version: "1",
    sections: mergedSections,
  };

  // Add optional fields from last align
  if (lastAlign.summary) {
    mergedAlign.summary = lastAlign.summary;
  }
  if (lastAlign.owner) {
    mergedAlign.owner = lastAlign.owner;
  }
  if (lastAlign.source) {
    mergedAlign.source = lastAlign.source;
  }
  if (lastAlign.source_sha) {
    mergedAlign.source_sha = lastAlign.source_sha;
  }

  // Add merged fields
  if (mergedPlugs) {
    mergedAlign.plugs = mergedPlugs;
  }
  if (mergedScope) {
    mergedAlign.scope = mergedScope;
  }
  if (mergedTags.length > 0) {
    mergedAlign.tags = mergedTags;
  }
  if (mergedDeps.length > 0) {
    mergedAlign.deps = mergedDeps;
  }

  return mergedAlign;
}

/**
 * Merge plugs from multiple aligns
 * Combines fills, validates no slot conflicts
 */
function mergePlugs(
  aligns: Align[],
  warnings: string[],
): Align["plugs"] | undefined {
  const allSlots: Record<
    string,
    {
      description: string;
      format: "command" | "text" | "file" | "url";
      required: boolean;
      example?: string;
    }
  > = {};
  const allFills: Record<string, string> = {};

  for (const align of aligns) {
    if (!align.plugs) continue;

    // Merge slots (detect conflicts)
    if (align.plugs.slots) {
      for (const [slotName, slotDef] of Object.entries(align.plugs.slots)) {
        const existing = allSlots[slotName];

        if (existing) {
          // Check if definitions match
          if (
            existing.format !== slotDef.format ||
            existing.required !== slotDef.required
          ) {
            warnings.push(
              `Plug slot conflict: "${slotName}" has different definitions. Using last definition.`,
            );
          }
        }

        allSlots[slotName] = slotDef;
      }
    }

    // Merge fills (last wins)
    if (align.plugs.fills) {
      for (const [slotName, fillValue] of Object.entries(align.plugs.fills)) {
        if (allFills[slotName] && allFills[slotName] !== fillValue) {
          warnings.push(
            `Plug fill conflict: "${slotName}" filled multiple times. Using last value.`,
          );
        }
        allFills[slotName] = fillValue;
      }
    }
  }

  // Return merged plugs if any exist
  if (
    Object.keys(allSlots).length === 0 &&
    Object.keys(allFills).length === 0
  ) {
    return undefined;
  }

  const result: Align["plugs"] = {};
  if (Object.keys(allSlots).length > 0) {
    result.slots = allSlots;
  }
  if (Object.keys(allFills).length > 0) {
    result.fills = allFills;
  }

  return result;
}

/**
 * Merge scopes from multiple aligns (union)
 */
function mergeScopes(aligns: Align[]): Align["scope"] | undefined {
  const allAppliesTo: string[] = [];
  const allExcludes: string[] = [];

  for (const align of aligns) {
    if (!align.scope) continue;

    if (align.scope.applies_to) {
      allAppliesTo.push(...align.scope.applies_to);
    }
    if (align.scope.excludes) {
      allExcludes.push(...align.scope.excludes);
    }
  }

  if (allAppliesTo.length === 0 && allExcludes.length === 0) {
    return undefined;
  }

  // Deduplicate and sort for determinism
  const uniqueAppliesTo = [...new Set(allAppliesTo)].sort();
  const uniqueExcludes = [...new Set(allExcludes)].sort();

  const result: Align["scope"] = {};
  if (uniqueAppliesTo.length > 0) {
    result.applies_to = uniqueAppliesTo;
  }
  if (uniqueExcludes.length > 0) {
    result.excludes = uniqueExcludes;
  }

  return result;
}

/**
 * Merge tags from multiple aligns (union, deduplicated)
 */
function mergeTags(aligns: Align[]): string[] {
  const allTags = new Set<string>();

  for (const align of aligns) {
    if (align.tags) {
      for (const tag of align.tags) {
        allTags.add(tag);
      }
    }
  }

  return Array.from(allTags).sort();
}

/**
 * Merge deps from multiple aligns (union, deduplicated, preserve order)
 */
function mergeDeps(aligns: Align[]): string[] {
  const allDeps = new Set<string>();
  const depOrder: string[] = [];

  for (const align of aligns) {
    if (align.deps) {
      for (const dep of align.deps) {
        if (!allDeps.has(dep)) {
          allDeps.add(dep);
          depOrder.push(dep);
        }
      }
    }
  }

  return depOrder;
}

/**
 * Filter align sections by scope configuration
 * Used to create scope-specific exports
 *
 * @param align - Full Align to filter
 * @param scope - Scope configuration with optional rulesets filter
 * @returns Filtered align with only sections matching the scope
 */
export function filterAlignByScope(
  align: Align,
  scope: { path: string; rulesets?: string[] },
): Align {
  // If no rulesets specified, include all sections
  if (!scope.rulesets || scope.rulesets.length === 0) {
    return align;
  }

  // Filter sections that match scope rulesets
  // A section matches if:
  // 1. It has no ruleset (applies to all scopes), OR
  // 2. Its ruleset is in the scope's rulesets array
  const filteredSections = align.sections.filter((section) => {
    // Sections without ruleset apply to all scopes
    if (!section.vendor?.aligntrue?.ruleset) {
      return true;
    }

    const sectionRuleset = section.vendor.aligntrue.ruleset;
    return scope.rulesets!.includes(sectionRuleset);
  });

  // Return align with filtered sections
  return {
    ...align,
    sections: filteredSections,
  };
}
