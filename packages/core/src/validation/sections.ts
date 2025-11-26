/**
 * Sections validation utilities
 * Provides shared validation for align sections array
 */

import type { AlignSection } from "@aligntrue/schema";

/**
 * Ensure align has valid sections array
 *
 * Type guard that validates align.sections is an array and optionally
 * throws on invalid input. Used across bundle, lockfile, sync, and overlay systems.
 *
 * @param align - Align object to validate
 * @param options - Validation options
 * @param options.throwOnInvalid - If true, throw error instead of initializing empty array
 * @throws Error if throwOnInvalid is true and sections is invalid
 *
 * @example
 * ```typescript
 * // Initialize empty array if missing (defensive)
 * ensureSectionsArray(align);
 * align.sections.forEach(section => ...);
 *
 * // Throw error if missing (strict validation)
 * ensureSectionsArray(align, { throwOnInvalid: true });
 * ```
 */
export function ensureSectionsArray(
  align: { sections?: unknown },
  options: { throwOnInvalid?: boolean } = {},
): asserts align is { sections: AlignSection[] } {
  if (!align.sections || !Array.isArray(align.sections)) {
    if (options.throwOnInvalid) {
      throw new Error(
        `Invalid align format: sections must be an array, got ${typeof align.sections}`,
      );
    }
    align.sections = [];
  }
}
