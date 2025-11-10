/**
 * High-level API for plugs resolution
 *
 * This is the primary entry point for resolving plugs in Align packs.
 * Used by sync engine, CLI commands, and tests.
 */

import type { AlignPack, Plugs } from "@aligntrue/schema";
import type { ResolvePackResult, ResolveOptions } from "./types.js";
import { mergePlugs, resolveText, findUndeclaredPlugs } from "./resolver.js";
import { PlugResolutionError } from "./types.js";

/**
 * Resolve plugs for an entire align pack
 *
 * This is the high-level API that should be called by:
 * - Sync engine (before calling exporters)
 * - CLI plugs resolve command
 * - Tests
 *
 * @param pack - Align pack to resolve
 * @param additionalFills - Additional fills from stack packs or repo (optional)
 * @param options - Resolution options
 * @returns Resolution result with resolved rules
 */
export function resolvePlugsForPack(
  pack: AlignPack,
  additionalFills?: Record<string, string>,
  options: ResolveOptions = {},
): ResolvePackResult {
  try {
    // Merge plugs from pack + additional fills
    const plugsSources: Array<{ plugs?: Plugs | undefined; source: string }> =
      [];

    if (pack.plugs) {
      plugsSources.push({ plugs: pack.plugs, source: "pack" });
    }

    if (additionalFills && Object.keys(additionalFills).length > 0) {
      plugsSources.push({
        plugs: { fills: additionalFills },
        source: "additional",
      });
    }

    const mergedPlugs = mergePlugs(plugsSources);

    // Build set of declared slots for validation
    const declaredSlots = new Set(Object.keys(mergedPlugs.slots || {}));

    // Resolve plugs in each rule's guidance
    const resolvedRules: ResolvePackResult["rules"] = [];
    const allUnresolvedRequired: string[] = [];
    const errors: string[] = [];

    // Only process rules if they exist (skip section-based packs)
    if (!pack.rules) {
      return {
        success: true,
        rules: [],
        unresolvedRequired: [],
      };
    }

    for (const rule of pack.rules) {
      if (rule.guidance) {
        // Check for undeclared plugs
        const undeclared = findUndeclaredPlugs(rule.guidance, declaredSlots);
        if (undeclared.length > 0) {
          errors.push(
            `Rule '${rule.id}' references undeclared plugs: ${undeclared.join(", ")}`,
          );
          continue;
        }

        // Resolve plugs
        const result = resolveText(rule.guidance, mergedPlugs);

        resolvedRules.push({
          ruleId: rule.id,
          guidance: result.text,
          resolutions: result.resolutions,
        });

        // Track unresolved required
        allUnresolvedRequired.push(...result.unresolvedRequired);
      } else {
        // No guidance, no resolution needed
        resolvedRules.push({
          ruleId: rule.id,
          resolutions: [],
        });
      }
    }

    // Check if we should fail on unresolved
    const uniqueUnresolved = [...new Set(allUnresolvedRequired)];
    if (options.failOnUnresolved && uniqueUnresolved.length > 0) {
      return {
        success: false,
        rules: resolvedRules,
        unresolvedRequired: uniqueUnresolved,
        errors: [
          `Strict mode: ${uniqueUnresolved.length} required plug(s) unresolved: ${uniqueUnresolved.join(", ")}`,
        ],
      };
    }

    if (errors.length > 0) {
      return {
        success: false,
        rules: resolvedRules,
        unresolvedRequired: uniqueUnresolved,
        errors,
      };
    }

    return {
      success: true,
      rules: resolvedRules,
      unresolvedRequired: uniqueUnresolved,
    };
  } catch (_error) {
    if (_error instanceof PlugResolutionError) {
      return {
        success: false,
        rules: [],
        unresolvedRequired: [],
        errors: [_error.message],
      };
    }
    throw _error;
  }
}

// Re-export types and utilities
export type {
  ResolvePackResult,
  ResolveOptions,
  PlugResolution,
  ResolveTextResult,
} from "./types.js";
export { PlugResolutionError } from "./types.js";
export { mergePlugs, resolveText, findUndeclaredPlugs } from "./resolver.js";
