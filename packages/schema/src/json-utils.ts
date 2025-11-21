/**
 * JSON utilities for deterministic operations
 *
 * Consolidates common JSON patterns across the codebase:
 * - Canonical JSON stringification (JCS)
 * - Content hashing (canonical + SHA-256)
 * - Type-safe parsing with error handling
 * - Comparison utilities
 *
 * Eliminates 100+ duplicate patterns (Code consolidation)
 */

import { canonicalizeJson, computeHash } from "./canonicalize.js";

/**
 * Result type for operations that may fail
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Stringify object using canonical JSON (JCS/RFC 8785)
 *
 * Always produces deterministic output with stable key ordering.
 * Use this instead of JSON.stringify when determinism matters.
 *
 * @param obj - Object to stringify
 * @param excludeVolatile - If true, exclude vendor.*.volatile fields (default: true)
 * @returns Canonical JSON string
 *
 * @example
 * ```typescript
 * const canon = stringifyCanonical({ b: 2, a: 1 });
 * // Always produces: {"a":1,"b":2}
 * ```
 */
export function stringifyCanonical(
  obj: unknown,
  excludeVolatile: boolean = true,
): string {
  return canonicalizeJson(obj, excludeVolatile);
}

/**
 * Compute content hash (canonical JSON + SHA-256)
 *
 * Combines canonicalization and hashing in one call.
 * Use this instead of separate canonicalizeJson + computeHash calls.
 *
 * @param obj - Object to hash
 * @param excludeVolatile - If true, exclude vendor.*.volatile fields (default: true)
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const hash = computeContentHash({ rules: [...] });
 * // Returns: "a1b2c3d4..." (64 hex chars)
 * ```
 */
export function computeContentHash(
  obj: unknown,
  excludeVolatile: boolean = true,
): string {
  const canonical = canonicalizeJson(obj, excludeVolatile);
  return computeHash(canonical);
}

/**
 * Parse JSON string with type-safe error handling
 *
 * Returns Result type instead of throwing exceptions.
 * Useful for parsing untrusted input.
 *
 * @param str - JSON string to parse
 * @returns Result with parsed value or error
 *
 * @example
 * ```typescript
 * const result = parseJsonSafe('{"valid": "json"}');
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function parseJsonSafe(str: string): Result<unknown, Error> {
  try {
    const value = JSON.parse(str);
    return { ok: true, value };
  } catch (_err) {
    const error = _err instanceof Error ? _err : new Error(String(_err));
    return { ok: false, error };
  }
}

/**
 * Hash an object (convenience wrapper)
 *
 * Shorthand for computeContentHash with default options.
 *
 * @param obj - Object to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const hash = hashObject({ id: "rule1", content: "..." });
 * ```
 */
export function hashObject(obj: unknown): string {
  return computeContentHash(obj, true);
}

/**
 * Compare two objects using canonical JSON
 *
 * Returns true if objects produce identical canonical JSON.
 * More reliable than deep equality because it handles:
 * - Different key ordering
 * - Volatile field exclusion
 * - Deterministic comparison
 *
 * @param a - First object
 * @param b - Second object
 * @returns true if canonically identical
 *
 * @example
 * ```typescript
 * compareCanonical({ b: 2, a: 1 }, { a: 1, b: 2 }); // true
 * ```
 */
export function compareCanonical(a: unknown, b: unknown): boolean {
  try {
    const canonA = canonicalizeJson(a, true);
    const canonB = canonicalizeJson(b, true);
    return canonA === canonB;
  } catch {
    // If canonicalization fails, objects are not equal
    return false;
  }
}

/**
 * Deep clone an object using structuredClone (Node 17+)
 *
 * Uses native structuredClone for performance, with fallback to JSON
 * parse/stringify for compatibility (though Node 20+ always has structuredClone).
 *
 * Preferred over `JSON.parse(JSON.stringify())` because it:
 * - Handles more types (Date, Map, Set, etc.)
 * - Faster performance
 * - More explicit intent
 *
 * @param obj - Object to clone
 * @returns Deeply cloned object
 *
 * @example
 * ```typescript
 * const original = { nested: { value: 1 }, arr: [1, 2] };
 * const cloned = cloneDeep(original);
 * cloned.nested.value = 2; // original.nested.value still 1
 * ```
 */
export function cloneDeep<T>(obj: T): T {
  if (typeof structuredClone !== "undefined") {
    return structuredClone(obj);
  }
  // Fallback for older environments (shouldn't hit with Node 20+)
  return JSON.parse(JSON.stringify(obj)) as T;
}
