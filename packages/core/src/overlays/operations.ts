/**
 * Overlay operations: set and remove (Overlays system)
 * Implements deterministic modifications to IR structures
 */

import { cloneDeep as cloneDeepUtil } from "@aligntrue/schema";

/**
 * Apply set operation to target object
 * Sets nested properties using dot notation
 * Example: set({ obj, key: "check.inputs.pattern", value: "^src/" })
 *
 * @param target - Target object to modify
 * @param key - Property path (supports dot notation)
 * @param value - Value to set
 * @returns Modified target (mutates in place)
 */
export function setProperty(
  target: unknown,
  key: string,
  value: unknown,
): void {
  if (!target || typeof target !== "object") {
    throw new Error(`Cannot set property on non-object: ${typeof target}`);
  }

  let current: Record<string, unknown> = ensurePlainObject(
    target,
    "target object",
  );
  const path = key.split(".");

  // Navigate to parent of target property
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (!segment) continue; // Skip empty segments
    // Prevent prototype pollution
    if (
      segment === "__proto__" ||
      segment === "constructor" ||
      segment === "prototype"
    ) {
      throw new Error(
        `Refusing to set dangerous key segment "${segment}" in path "${key}"`,
      );
    }

    // Create intermediate objects if they don't exist
    if (!(segment in current)) {
      current[segment] = {};
    }

    const next = current[segment];
    if (!isPlainObject(next)) {
      throw new Error(
        `Cannot set property "${key}": "${path.slice(0, i + 1).join(".")}" is not an object`,
      );
    }

    current = next;
  }

  // Set the final property
  const finalKey = path[path.length - 1];
  if (
    finalKey &&
    finalKey !== "__proto__" &&
    finalKey !== "constructor" &&
    finalKey !== "prototype"
  ) {
    current[finalKey] = value;
  } else if (finalKey) {
    throw new Error(`Refusing to set dangerous property name "${finalKey}"`);
  }
}

/**
 * Apply remove operation to target object
 * Removes properties using dot notation
 *
 * @param target - Target object to modify
 * @param key - Property path (supports dot notation)
 * @returns Whether property was removed
 */
export function removeProperty(target: unknown, key: string): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  let current: Record<string, unknown>;
  try {
    current = ensurePlainObject(target, "target object");
  } catch {
    return false;
  }
  const path = key.split(".");

  // Navigate to parent of target property
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (!segment) continue; // Skip empty segments

    // Prevent prototype pollution
    if (["__proto__", "constructor", "prototype"].includes(segment)) {
      throw new Error(
        `Invalid property path: segment "${segment}" is disallowed`,
      );
    }

    if (!(segment in current)) {
      return false;
    }

    const next = current[segment];
    if (!isPlainObject(next)) {
      return false;
    }

    current = next;
  }

  // Remove the final property
  const finalKey = path[path.length - 1];
  if (
    finalKey &&
    !["__proto__", "constructor", "prototype"].includes(finalKey) &&
    finalKey in current
  ) {
    delete current[finalKey];
    return true;
  }

  return false;
}

/**
 * Apply multiple set operations to target
 * Applies operations in stable sort order by key
 *
 * @param target - Target object to modify
 * @param operations - Map of key -> value to set
 */
export function applySetOperations(
  target: unknown,
  operations: Record<string, unknown>,
): void {
  // Sort keys for deterministic application order
  const sortedKeys = Object.keys(operations).sort();

  for (const key of sortedKeys) {
    setProperty(target, key, operations[key]);
  }
}

/**
 * Apply multiple remove operations to target
 * Applies operations in stable sort order by key
 *
 * @param target - Target object to modify
 * @param keys - Array of keys to remove
 */
export function applyRemoveOperations(target: unknown, keys: string[]): void {
  // Sort keys for deterministic application order
  const sortedKeys = [...keys].sort();

  for (const key of sortedKeys) {
    removeProperty(target, key);
  }
}

/**
 * Merge arrays as sets (union + stable sort)
 * Used for array properties that behave as sets (e.g., applies_to, tags)
 *
 * @param baseArray - Base array
 * @param overlayArray - Overlay array to merge
 * @returns Merged and sorted array (no duplicates)
 */
export function mergeArraysAsSet<T>(baseArray: T[], overlayArray: T[]): T[] {
  // Convert to Set for deduplication
  const merged = new Set([...baseArray, ...overlayArray]);

  // Convert back to array and sort
  const result = Array.from(merged);

  // Sort for determinism (stable sort by string representation)
  result.sort((a, b) => {
    const strA = String(a);
    const strB = String(b);
    return strA.localeCompare(strB);
  });

  return result;
}

/**
 * Deep clone an object for safe modification
 * Uses structuredClone for performance and compatibility
 *
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return cloneDeepUtil(obj);
}

function ensurePlainObject(
  value: unknown,
  name: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`Expected ${name} to be a plain object`);
  }
  return value;
}

/**
 * Check if a value is a plain object (not array, null, etc.)
 *
 * @param value - Value to check
 * @returns Whether value is a plain object
 */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}
