/**
 * Sections validation utilities
 * Provides shared validation for pack sections array
 */

import type { AlignSection } from "@aligntrue/schema";

/**
 * Ensure pack has valid sections array
 *
 * Type guard that validates pack.sections is an array and optionally
 * throws on invalid input. Used across bundle, lockfile, sync, and overlay systems.
 *
 * @param pack - Pack object to validate
 * @param options - Validation options
 * @param options.throwOnInvalid - If true, throw error instead of initializing empty array
 * @throws Error if throwOnInvalid is true and sections is invalid
 *
 * @example
 * ```typescript
 * // Initialize empty array if missing (defensive)
 * ensureSectionsArray(pack);
 * pack.sections.forEach(section => ...);
 *
 * // Throw error if missing (strict validation)
 * ensureSectionsArray(pack, { throwOnInvalid: true });
 * ```
 */
export function ensureSectionsArray(
  pack: { sections?: unknown },
  options: { throwOnInvalid?: boolean } = {},
): asserts pack is { sections: AlignSection[] } {
  if (!pack.sections || !Array.isArray(pack.sections)) {
    if (options.throwOnInvalid) {
      throw new Error(
        `Invalid pack format: sections must be an array, got ${typeof pack.sections}`,
      );
    }
    pack.sections = [];
  }
}
