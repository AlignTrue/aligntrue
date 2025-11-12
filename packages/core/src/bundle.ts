/**
 * Bundle merging - combine multiple AlignPacks into a single pack
 *
 * Merge strategy:
 * - Sections with same fingerprint: last source wins (with warning)
 * - Metadata: merge with last-wins precedence
 * - Plugs: merge fills, validate no slot conflicts
 * - Scopes: union of all scopes
 */

import type { AlignPack, AlignSection } from "@aligntrue/schema";

export interface BundleOptions {
  /**
   * Whether to warn about conflicting rules (default: true)
   */
  warnConflicts?: boolean;

  /**
   * Bundle ID for the merged pack (default: "merged-bundle")
   */
  bundleId?: string;

  /**
   * Bundle version (default: "1.0.0")
   */
  bundleVersion?: string;
}

export interface BundleResult {
  /**
   * Merged AlignPack
   */
  pack: AlignPack;

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
 * Merge multiple AlignPacks into a single bundle
 *
 * @param packs - Array of AlignPacks to merge (in precedence order)
 * @param options - Merge options
 * @returns Merged pack with conflict information
 */
export function mergePacks(
  packs: AlignPack[],
  options?: BundleOptions,
): BundleResult {
  if (packs.length === 0) {
    throw new Error("Cannot merge empty pack array");
  }

  if (packs.length === 1) {
    const pack = packs[0];
    if (!pack) {
      throw new Error("First pack is undefined");
    }
    // Defensive: Initialize sections to empty array if missing
    if (!pack.sections || !Array.isArray(pack.sections)) {
      pack.sections = [];
    }
    // Sort sections by fingerprint for determinism if pack has sections
    if (pack.sections.length > 1) {
      const sortedSections = [...pack.sections].sort((a, b) =>
        a.fingerprint.localeCompare(b.fingerprint),
      );
      return {
        pack: { ...pack, sections: sortedSections },
        conflicts: [],
        warnings: [],
      };
    }
    return {
      pack,
      conflicts: [],
      warnings: [],
    };
  }

  const warnConflicts = options?.warnConflicts ?? true;
  const bundleId = options?.bundleId ?? "merged-bundle";
  const bundleVersion = options?.bundleVersion ?? "1.0.0";

  const conflicts: BundleResult["conflicts"] = [];
  const warnings: string[] = [];

  // Determine if we're merging section-based or rule-based packs
  const firstPack = packs[0];
  if (!firstPack) {
    throw new Error("First pack is undefined");
  }

  // Merge section-based packs using fingerprints
  const sectionMap = new Map<
    string,
    {
      section: AlignSection;
      source: string;
      sourceIndex: number;
    }
  >();

  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    if (!pack) continue;

    // Defensive: Initialize sections to empty array if missing
    if (!pack.sections || !Array.isArray(pack.sections)) {
      pack.sections = [];
    }

    const sourceName = pack.id || `source-${i}`;

    for (const section of pack.sections) {
      const existing = sectionMap.get(section.fingerprint);

      if (existing) {
        // Conflict detected
        conflicts.push({
          fingerprint: section.fingerprint,
          sources: [existing.source, sourceName],
          resolution: sourceName,
        });

        if (warnConflicts) {
          warnings.push(
            `Section conflict: "${section.heading}" (${section.fingerprint}) defined in both "${existing.source}" and "${sourceName}". Using "${sourceName}".`,
          );
        }
      }

      // Last source wins
      sectionMap.set(section.fingerprint, {
        section,
        source: sourceName,
        sourceIndex: i,
      });
    }
  }

  // Extract merged sections (sorted by fingerprint for determinism)
  const mergedSections = Array.from(sectionMap.values())
    .sort((a, b) => a.section.fingerprint.localeCompare(b.section.fingerprint))
    .map((entry) => entry.section);

  // Merge metadata (last source wins)
  const lastPack = packs[packs.length - 1];
  if (!lastPack) {
    throw new Error("Last pack is undefined");
  }

  // Merge plugs (combine fills, detect slot conflicts)
  const mergedPlugs = mergePlugs(packs, warnings);

  // Merge scopes (union of all scopes)
  const mergedScope = mergeScopes(packs);

  // Merge tags (union, deduplicated)
  const mergedTags = mergeTags(packs);

  // Merge deps (union, deduplicated, preserve order)
  const mergedDeps = mergeDeps(packs);

  // Build merged pack
  const mergedPack: AlignPack = {
    id: bundleId,
    version: bundleVersion,
    spec_version: "1",
    sections: mergedSections,
  };

  // Add optional fields from last pack
  if (lastPack.summary) {
    mergedPack.summary = lastPack.summary;
  }
  if (lastPack.owner) {
    mergedPack.owner = lastPack.owner;
  }
  if (lastPack.source) {
    mergedPack.source = lastPack.source;
  }
  if (lastPack.source_sha) {
    mergedPack.source_sha = lastPack.source_sha;
  }

  // Add merged fields
  if (mergedPlugs) {
    mergedPack.plugs = mergedPlugs;
  }
  if (mergedScope) {
    mergedPack.scope = mergedScope;
  }
  if (mergedTags.length > 0) {
    mergedPack.tags = mergedTags;
  }
  if (mergedDeps.length > 0) {
    mergedPack.deps = mergedDeps;
  }

  return {
    pack: mergedPack,
    conflicts,
    warnings,
  };
}

/**
 * Merge plugs from multiple packs
 * Combines fills, validates no slot conflicts
 */
function mergePlugs(
  packs: AlignPack[],
  warnings: string[],
): AlignPack["plugs"] | undefined {
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

  for (const pack of packs) {
    if (!pack.plugs) continue;

    // Merge slots (detect conflicts)
    if (pack.plugs.slots) {
      for (const [slotName, slotDef] of Object.entries(pack.plugs.slots)) {
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
    if (pack.plugs.fills) {
      for (const [slotName, fillValue] of Object.entries(pack.plugs.fills)) {
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

  const result: AlignPack["plugs"] = {};
  if (Object.keys(allSlots).length > 0) {
    result.slots = allSlots;
  }
  if (Object.keys(allFills).length > 0) {
    result.fills = allFills;
  }

  return result;
}

/**
 * Merge scopes from multiple packs (union)
 */
function mergeScopes(packs: AlignPack[]): AlignPack["scope"] | undefined {
  const allAppliesTo: string[] = [];
  const allExcludes: string[] = [];

  for (const pack of packs) {
    if (!pack.scope) continue;

    if (pack.scope.applies_to) {
      allAppliesTo.push(...pack.scope.applies_to);
    }
    if (pack.scope.excludes) {
      allExcludes.push(...pack.scope.excludes);
    }
  }

  if (allAppliesTo.length === 0 && allExcludes.length === 0) {
    return undefined;
  }

  // Deduplicate and sort for determinism
  const uniqueAppliesTo = [...new Set(allAppliesTo)].sort();
  const uniqueExcludes = [...new Set(allExcludes)].sort();

  const result: AlignPack["scope"] = {};
  if (uniqueAppliesTo.length > 0) {
    result.applies_to = uniqueAppliesTo;
  }
  if (uniqueExcludes.length > 0) {
    result.excludes = uniqueExcludes;
  }

  return result;
}

/**
 * Merge tags from multiple packs (union, deduplicated)
 */
function mergeTags(packs: AlignPack[]): string[] {
  const allTags = new Set<string>();

  for (const pack of packs) {
    if (pack.tags) {
      for (const tag of pack.tags) {
        allTags.add(tag);
      }
    }
  }

  return Array.from(allTags).sort();
}

/**
 * Merge deps from multiple packs (union, deduplicated, preserve order)
 */
function mergeDeps(packs: AlignPack[]): string[] {
  const allDeps = new Set<string>();
  const depOrder: string[] = [];

  for (const pack of packs) {
    if (pack.deps) {
      for (const dep of pack.deps) {
        if (!allDeps.has(dep)) {
          allDeps.add(dep);
          depOrder.push(dep);
        }
      }
    }
  }

  return depOrder;
}
