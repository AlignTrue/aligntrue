/**
 * Bundle merging - combine multiple AlignPacks into a single pack
 *
 * Merge strategy:
 * - Rules with same ID: last source wins (with warning)
 * - Metadata: merge with last-wins precedence
 * - Plugs: merge fills, validate no slot conflicts
 * - Scopes: union of all scopes
 */

import type { AlignPack, AlignRule } from "@aligntrue/schema";

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
    ruleId: string;
    sources: string[]; // Which sources had this rule
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

  // Track rules by ID to detect conflicts
  const ruleMap = new Map<
    string,
    {
      rule: AlignRule;
      source: string;
      sourceIndex: number;
    }
  >();

  // Merge rules (last source wins for conflicts)
  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    if (!pack) continue;

    const sourceName = pack.id || `source-${i}`;

    for (const rule of pack.rules) {
      const existing = ruleMap.get(rule.id);

      if (existing) {
        // Conflict detected
        conflicts.push({
          ruleId: rule.id,
          sources: [existing.source, sourceName],
          resolution: sourceName,
        });

        if (warnConflicts) {
          warnings.push(
            `Rule conflict: "${rule.id}" defined in both "${existing.source}" and "${sourceName}". Using "${sourceName}".`,
          );
        }
      }

      // Last source wins
      ruleMap.set(rule.id, {
        rule,
        source: sourceName,
        sourceIndex: i,
      });
    }
  }

  // Extract merged rules (sorted by ID for determinism)
  const mergedRules = Array.from(ruleMap.values())
    .sort((a, b) => a.rule.id.localeCompare(b.rule.id))
    .map((entry) => entry.rule);

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
    rules: mergedRules,
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
