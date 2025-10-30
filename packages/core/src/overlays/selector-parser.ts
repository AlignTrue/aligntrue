/**
 * Selector parser for overlays (Phase 3.5)
 * Parses deterministic selector syntax: rule[id=...], property paths, array indices
 * No wildcards, no computed functions, no regex
 */

import { ParsedSelector, SelectorType } from "./types.js";

/**
 * Parse a selector string into structured components
 * Supported formats:
 * - rule[id=value] - Select rule by ID
 * - path.to.property - Select property by path
 * - array[0] - Select array element by index
 *
 * @param selector - Selector string
 * @returns ParsedSelector object or null if invalid
 */
export function parseSelector(selector: string): ParsedSelector | null {
  if (!selector || typeof selector !== "string") {
    return null;
  }

  const trimmed = selector.trim();
  if (!trimmed) {
    return null;
  }

  // Try parsing as rule selector: rule[id=value]
  const ruleMatch = trimmed.match(/^rule\[id=([^\]]+)\]$/);
  if (ruleMatch) {
    const ruleId = ruleMatch[1];
    if (!ruleId || ruleId.includes("*") || ruleId.includes("?")) {
      return null; // No wildcards allowed
    }
    return {
      type: "rule",
      ruleId,
    };
  }

  // Try parsing as array index: path.to.array[0]
  const arrayMatch = trimmed.match(/^(.+)\[(\d+)\]$/);
  if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
    const propertyPath = arrayMatch[1];
    const index = parseInt(arrayMatch[2], 10);
    if (propertyPath.includes("*") || propertyPath.includes("?")) {
      return null; // No wildcards in property paths
    }
    const pathSegments = propertyPath.split(".").filter(Boolean);
    if (pathSegments.length === 0) {
      return null;
    }
    return {
      type: "array_index",
      propertyPath: pathSegments,
      arrayIndex: index,
    };
  }

  // Parse as property path: path.to.property
  if (trimmed.includes("*") || trimmed.includes("?") || trimmed.includes("[")) {
    return null; // No wildcards or invalid syntax
  }

  return {
    type: "property",
    propertyPath: trimmed.split(".").filter(Boolean),
  };
}

/**
 * Validate a parsed selector for correctness
 * Checks for:
 * - No wildcards (*, ?)
 * - No computed functions
 * - No regex patterns
 * - Valid syntax
 *
 * @param selector - Selector string
 * @returns Validation result with error message if invalid
 */
export function validateSelector(selector: string): {
  valid: boolean;
  error?: string;
} {
  if (!selector || typeof selector !== "string") {
    return { valid: false, error: "Selector must be a non-empty string" };
  }

  const trimmed = selector.trim();
  if (!trimmed) {
    return { valid: false, error: "Selector cannot be empty or whitespace" };
  }

  // Check for wildcards
  if (trimmed.includes("*") || trimmed.includes("?")) {
    return {
      valid: false,
      error: "Wildcards (* or ?) are not allowed in selectors for determinism",
    };
  }

  // Check for regex patterns (common indicators)
  if (
    trimmed.includes(".*") ||
    trimmed.includes(".+") ||
    trimmed.includes("^") ||
    trimmed.includes("$")
  ) {
    return {
      valid: false,
      error: "Regex patterns are not allowed in selectors for determinism",
    };
  }

  // Check for computed functions (common indicators)
  if (trimmed.includes("(") || trimmed.includes(")")) {
    return {
      valid: false,
      error: "Computed functions are not allowed in selectors for determinism",
    };
  }

  // Try parsing
  const parsed = parseSelector(trimmed);
  if (!parsed) {
    return {
      valid: false,
      error:
        "Invalid selector syntax. Supported formats: rule[id=value], path.to.property, array[0]",
    };
  }

  // Additional validation for rule selectors
  if (parsed.type === "rule") {
    if (!parsed.ruleId) {
      return { valid: false, error: "Rule ID cannot be empty" };
    }
    if (parsed.ruleId.length > 200) {
      return { valid: false, error: "Rule ID exceeds maximum length of 200" };
    }
  }

  // Additional validation for property paths
  if (parsed.type === "property" || parsed.type === "array_index") {
    if (!parsed.propertyPath || parsed.propertyPath.length === 0) {
      return { valid: false, error: "Property path cannot be empty" };
    }
    if (parsed.propertyPath.length > 10) {
      return {
        valid: false,
        error: "Property path exceeds maximum depth of 10 levels",
      };
    }
    for (const segment of parsed.propertyPath) {
      if (segment.length > 100) {
        return {
          valid: false,
          error: "Property path segment exceeds maximum length of 100",
        };
      }
    }
  }

  // Additional validation for array indices
  if (parsed.type === "array_index") {
    if (
      parsed.arrayIndex === undefined ||
      parsed.arrayIndex < 0 ||
      parsed.arrayIndex > 1000
    ) {
      return {
        valid: false,
        error: "Array index must be between 0 and 1000",
      };
    }
  }

  return { valid: true };
}

/**
 * Normalize a selector string for stable sorting
 * Ensures consistent formatting across different inputs
 *
 * @param selector - Selector string
 * @returns Normalized selector string
 */
export function normalizeSelector(selector: string): string {
  const parsed = parseSelector(selector);
  if (!parsed) {
    return selector.trim();
  }

  switch (parsed.type) {
    case "rule":
      return `rule[id=${parsed.ruleId}]`;
    case "array_index":
      return `${parsed.propertyPath!.join(".")}[${parsed.arrayIndex}]`;
    case "property":
      return parsed.propertyPath!.join(".");
    default:
      return selector.trim();
  }
}

/**
 * Compare selectors for stable sorting
 * Sort order:
 * 1. By selector type (rule < property < array_index)
 * 2. By normalized selector string (lexicographic)
 *
 * @param a - First selector
 * @param b - Second selector
 * @returns Comparison result (-1, 0, 1)
 */
export function compareSelectors(a: string, b: string): number {
  const parsedA = parseSelector(a);
  const parsedB = parseSelector(b);

  if (!parsedA || !parsedB) {
    // Fallback to string comparison for invalid selectors
    return a.localeCompare(b);
  }

  // Define type order
  const typeOrder: Record<SelectorType, number> = {
    rule: 0,
    property: 1,
    array_index: 2,
  };

  const typeA = typeOrder[parsedA.type];
  const typeB = typeOrder[parsedB.type];

  if (typeA !== typeB) {
    return typeA - typeB;
  }

  // Same type, compare normalized strings
  const normA = normalizeSelector(a);
  const normB = normalizeSelector(b);
  return normA.localeCompare(normB);
}
