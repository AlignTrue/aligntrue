/**
 * High-level API for plugs resolution
 *
 * This is the primary entry point for resolving plugs in Align aligns.
 * Used by sync engine, CLI commands, and tests.
 */

import type { Align, Plugs } from "@aligntrue/schema";
import type { ResolveAlignResult, ResolveOptions } from "./types.js";
import { mergePlugs, resolveText, findUndeclaredPlugs } from "./resolver.js";
import { PlugResolutionError } from "./types.js";

/**
 * Resolve plugs for an entire align align
 *
 * This is the high-level API that should be called by:
 * - Sync engine (before calling exporters)
 * - CLI plugs resolve command
 * - Tests
 *
 * @param align - Align align to resolve
 * @param additionalFills - Additional fills from stack aligns or repo (optional)
 * @param options - Resolution options
 * @returns Resolution result with resolved rules
 */
export function resolvePlugsForAlign(
  align: Align,
  additionalFills?: Record<string, string>,
  options: ResolveOptions = {},
): ResolveAlignResult {
  /**
   * NOTE: Config fills are loaded from .aligntrue/config.yaml via sync engine
   * The fills are passed as additionalFills parameter to this function
   *
   * Testing gotcha: If using CLI commands like 'plugs set', the config is immediately
   * persisted to disk via saveConfig(). Subsequent commands should load and use these fills.
   * If fills appear missing, check:
   * 1. Config file has plugs.fills section with correct YAML structure
   * 2. Sync engine is passing config.plugs.fills to resolvePlugsForAlign()
   */
  try {
    // Merge plugs from align + additional fills
    const plugsSources: Array<{ plugs?: Plugs | undefined; source: string }> =
      [];

    // Slots come from IR; fills come only from config/additionalFills
    if (align.plugs && (align.plugs.slots || align.plugs.fills)) {
      plugsSources.push({
        plugs: align.plugs,
        source: "align",
      });
    }

    if (additionalFills && Object.keys(additionalFills).length > 0) {
      plugsSources.push({
        plugs: { fills: additionalFills },
        source: "config",
      });
    }

    const mergedPlugs = mergePlugs(plugsSources);

    // Build set of declared slots for validation
    const declaredSlots = new Set(Object.keys(mergedPlugs.slots || {}));

    // Resolve plugs in each rule's content
    const resolvedRules: ResolveAlignResult["rules"] = [];
    const allUnresolvedRequired: string[] = [];
    const errors: string[] = [];

    // Process sections from align
    for (const section of align.sections) {
      if (section.content) {
        // Check for undeclared plugs
        const undeclared = findUndeclaredPlugs(section.content, declaredSlots);
        if (undeclared.length > 0) {
          errors.push(
            `Section '${section.fingerprint}' references undeclared plugs: ${undeclared.join(", ")}`,
          );
          continue;
        }

        // Resolve plugs
        const result = resolveText(section.content, mergedPlugs);

        resolvedRules.push({
          ruleId: section.fingerprint,
          content: result.text,
          resolutions: result.resolutions,
        });

        // Track unresolved required
        allUnresolvedRequired.push(...result.unresolvedRequired);
      } else {
        // No content, no resolution needed
        resolvedRules.push({
          ruleId: section.fingerprint,
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
  ResolveAlignResult,
  ResolveOptions,
  PlugResolution,
  ResolveTextResult,
} from "./types.js";
export { PlugResolutionError } from "./types.js";
export { mergePlugs, resolveText, findUndeclaredPlugs } from "./resolver.js";
export {
  validateFill,
  validateCommand,
  validateFile,
  validateText,
  type PlugFormat,
  type ValidationResult,
} from "./validator.js";
