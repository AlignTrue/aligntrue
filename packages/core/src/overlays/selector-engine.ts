/**
 * Selector evaluation engine for overlays (Overlays system)
 * Evaluates selectors against AlignPack IR to find targets for overlay application
 */

import type { AlignPack } from "@aligntrue/schema";
import { parseSelector } from "./selector-parser.js";
import { SelectorMatch } from "./types.js";

/**
 * Evaluate a selector against an AlignPack IR
 * Selector must match exactly one target for success
 *
 * @param selector - Selector string
 * @param ir - AlignPack IR to search
 * @returns SelectorMatch result with target path and value
 */
export function evaluateSelector(
  selector: string,
  ir: AlignPack,
): SelectorMatch {
  const parsed = parseSelector(selector);
  if (!parsed) {
    return {
      success: false,
      error: `Invalid selector syntax: ${selector}`,
      matchCount: 0,
    };
  }

  switch (parsed.type) {
    case "rule":
      return evaluateRuleSelector(parsed.ruleId!, ir);
    case "property":
      return evaluatePropertySelector(parsed.propertyPath!, ir);
    case "array_index":
      return evaluateArrayIndexSelector(
        parsed.propertyPath!,
        parsed.arrayIndex!,
        ir,
      );
    default:
      return {
        success: false,
        error: `Unsupported selector type: ${parsed.type}`,
        matchCount: 0,
      };
  }
}

/**
 * Evaluate section[fingerprint=...] selector
 * Searches for section with matching fingerprint in pack.sections array
 */
function evaluateRuleSelector(ruleId: string, ir: AlignPack): SelectorMatch {
  const matches: Array<{ index: number; fingerprint: string }> = [];
  for (let i = 0; i < ir.sections.length; i++) {
    const section = ir.sections[i];
    if (section && section.fingerprint === ruleId) {
      matches.push({ index: i, fingerprint: section.fingerprint });
    }
  }

  if (matches.length === 0) {
    return {
      success: false,
      error: `No rule found with id="${ruleId}"`,
      matchCount: 0,
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      error: `Selector matched ${matches.length} rules with id="${ruleId}" (expected exactly 1)`,
      matchCount: matches.length,
    };
  }

  const match = matches[0];
  if (!match) {
    return {
      success: false,
      error: "Unexpected error: match is undefined",
      matchCount: 0,
    };
  }
  return {
    success: true,
    targetPath: ["sections", String(match.index)],
    targetValue: match.fingerprint,
    matchCount: 1,
  };
}

/**
 * Evaluate property path selector
 * Navigates nested object properties
 */
function evaluatePropertySelector(
  propertyPath: string[],
  ir: AlignPack,
): SelectorMatch {
  if (!propertyPath || propertyPath.length === 0) {
    return {
      success: false,
      error: "Property path is empty",
      matchCount: 0,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = ir;
  const traversedPath: string[] = [];

  for (const segment of propertyPath) {
    traversedPath.push(segment);

    if (current === null || current === undefined) {
      return {
        success: false,
        error: `Property path "${propertyPath.join(".")}" does not exist: "${traversedPath.join(".")}" is ${current}`,
        matchCount: 0,
      };
    }

    if (typeof current !== "object") {
      return {
        success: false,
        error: `Property path "${propertyPath.join(".")}" does not exist: "${traversedPath.slice(0, -1).join(".")}" is not an object`,
        matchCount: 0,
      };
    }

    if (!(segment in current)) {
      return {
        success: false,
        error: `Property path "${propertyPath.join(".")}" does not exist: property "${segment}" not found`,
        matchCount: 0,
      };
    }

    current = current[segment];
  }

  return {
    success: true,
    targetPath: propertyPath,
    targetValue: current,
    matchCount: 1,
  };
}

/**
 * Evaluate array index selector
 * Navigates to property path then accesses array index
 */
function evaluateArrayIndexSelector(
  propertyPath: string[],
  arrayIndex: number,
  ir: AlignPack,
): SelectorMatch {
  // First navigate to the property containing the array
  const propertyResult = evaluatePropertySelector(propertyPath, ir);
  if (!propertyResult.success) {
    return propertyResult;
  }

  const arrayValue = propertyResult.targetValue;
  if (!Array.isArray(arrayValue)) {
    return {
      success: false,
      error: `Property "${propertyPath.join(".")}" is not an array`,
      matchCount: 0,
    };
  }

  if (arrayIndex < 0 || arrayIndex >= arrayValue.length) {
    return {
      success: false,
      error: `Array index ${arrayIndex} out of bounds for "${propertyPath.join(".")}" (length: ${arrayValue.length})`,
      matchCount: 0,
    };
  }

  return {
    success: true,
    targetPath: [...propertyPath, String(arrayIndex)],
    targetValue: arrayValue[arrayIndex],
    matchCount: 1,
  };
}

/**
 * Batch evaluate multiple selectors against IR
 * Returns results for each selector in order
 *
 * @param selectors - Array of selector strings
 * @param ir - AlignPack IR
 * @returns Array of SelectorMatch results (same order as input)
 */
export function evaluateSelectors(
  selectors: string[],
  ir: AlignPack,
): SelectorMatch[] {
  return selectors.map((selector) => evaluateSelector(selector, ir));
}

/**
 * Find all stale selectors (no matches in current IR)
 * Useful for validation and CI gates
 *
 * @param selectors - Array of selector strings
 * @param ir - AlignPack IR
 * @returns Array of stale selector strings
 */
export function findStaleSelectors(
  selectors: string[],
  ir: AlignPack,
): string[] {
  const stale: string[] = [];
  for (const selector of selectors) {
    const result = evaluateSelector(selector, ir);
    if (!result.success && result.matchCount === 0) {
      stale.push(selector);
    }
  }
  return stale;
}

/**
 * Find all ambiguous selectors (multiple matches)
 * Useful for validation and CI gates
 *
 * @param selectors - Array of selector strings
 * @param ir - AlignPack IR
 * @returns Array of ambiguous selector strings with match counts
 */
export function findAmbiguousSelectors(
  selectors: string[],
  ir: AlignPack,
): Array<{ selector: string; matchCount: number }> {
  const ambiguous: Array<{ selector: string; matchCount: number }> = [];
  for (const selector of selectors) {
    const result = evaluateSelector(selector, ir);
    if (!result.success && result.matchCount && result.matchCount > 1) {
      ambiguous.push({ selector, matchCount: result.matchCount });
    }
  }
  return ambiguous;
}
