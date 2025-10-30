/**
 * Core plug resolution logic
 *
 * Resolution algorithm:
 * 1. Normalize CRLF/CR to LF
 * 2. Protect escapes: sentinel-replace [[\plug: so they are not resolved
 * 3. For each [[plug:key]]:
 *    - If fill exists → replace with value
 *    - Else if required → insert TODO block
 *    - Else → replace with empty string
 * 4. Unescape sentinel back to [[plug: for [[\plug:...]]
 * 5. Ensure single trailing LF
 */

import type { Plugs } from "@aligntrue/schema";
import {
  validatePlugKey,
  validatePlugValue,
  validatePlugSlot,
} from "@aligntrue/schema";
import type { ResolveTextResult, PlugResolution } from "./types.js";
import { PlugResolutionError } from "./types.js";

/**
 * Sentinel for protecting escaped plugs
 */
const ESCAPE_SENTINEL = "\u0000PLUG_ESCAPE\u0000";

/**
 * Normalize line endings to LF
 */
function normalizeLF(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Ensure text ends with exactly one LF
 */
function ensureSingleTrailingLF(text: string): string {
  // Remove all trailing whitespace
  let result = text.replace(/\s+$/, "");
  // Add single LF
  return result + "\n";
}

/**
 * Generate TODO block for unresolved required plug
 */
function generateTODO(key: string, example?: string): string {
  if (example) {
    return `TODO(plug:${key}): Provide a value for this plug.\nExamples: ${example}\n`;
  }
  return `TODO(plug:${key}): Provide a value for this plug.\n`;
}

/**
 * Validate and merge plugs from multiple sources
 *
 * Merge order: base < stack < repo (last writer wins)
 * Deterministic tie-breaking: alphabetically by source name, then file path
 */
export function mergePlugs(
  plugsSources: Array<{ plugs?: Plugs | undefined; source: string }>,
): Plugs {
  const mergedSlots: Record<string, any> = {};
  const mergedFills: Record<string, string> = {};

  // Sort sources for deterministic merge order
  const sorted = [...plugsSources].sort((a, b) =>
    a.source.localeCompare(b.source),
  );

  // Merge slots (later overrides earlier)
  for (const { plugs } of sorted) {
    if (plugs?.slots) {
      for (const [key, slot] of Object.entries(plugs.slots)) {
        // Validate key
        const keyValidation = validatePlugKey(key);
        if (!keyValidation.valid) {
          throw new PlugResolutionError(
            `Invalid plug key: ${keyValidation.error}`,
            key,
            "invalid_key",
          );
        }

        // Validate slot
        const slotValidation = validatePlugSlot(slot);
        if (!slotValidation.valid) {
          throw new PlugResolutionError(
            `Invalid plug slot '${key}': ${slotValidation.error}`,
            key,
            "invalid_slot",
          );
        }

        mergedSlots[key] = slot;
      }
    }
  }

  // Merge fills (later overrides earlier)
  for (const { plugs } of sorted) {
    if (plugs?.fills) {
      for (const [key, fill] of Object.entries(plugs.fills)) {
        // Validate key
        const keyValidation = validatePlugKey(key);
        if (!keyValidation.valid) {
          throw new PlugResolutionError(
            `Invalid plug key in fills: ${keyValidation.error}`,
            key,
            "invalid_key",
          );
        }

        // Check if fill is for a declared slot
        const slot = mergedSlots[key];
        if (slot) {
          // Validate fill value matches slot format
          const valueValidation = validatePlugValue(fill, slot.format);
          if (!valueValidation.valid) {
            throw new PlugResolutionError(
              `Invalid fill for '${key}': ${valueValidation.error}`,
              key,
              "invalid_fill",
            );
          }
          mergedFills[key] = valueValidation.sanitized || fill;
        } else {
          // Fill without slot - store but will warn later
          mergedFills[key] = fill.trim();
        }
      }
    }
  }

  const result: Plugs = {};

  if (Object.keys(mergedSlots).length > 0) {
    result.slots = mergedSlots;
  }

  if (Object.keys(mergedFills).length > 0) {
    result.fills = mergedFills;
  }

  return result;
}

/**
 * Resolve plugs in text
 *
 * @param text - Text containing [[plug:key]] placeholders
 * @param plugs - Merged plugs (slots + fills)
 * @returns Resolved text with LF normalization
 */
export function resolveText(text: string, plugs: Plugs): ResolveTextResult {
  const resolutions: PlugResolution[] = [];
  const unresolvedRequired: string[] = [];

  // Step 1: Normalize LF
  let resolved = normalizeLF(text);

  // Step 2 & 3: Find all [[plug:key]] references, excluding escaped ones [[\plug:key]]
  // We look for patterns that DON'T have a backslash before 'plug:'
  const plugPattern = /\[\[plug:([a-z0-9._-]+)\]\]/g;
  const allMatches = [...resolved.matchAll(plugPattern)];

  // Filter out matches that are actually escaped (check if previous char is backslash)
  const matches = allMatches.filter((m) => {
    if (m.index === undefined) return false;
    // Check if there's a backslash right before 'plug:' (position is index + 2)
    const charBeforePlug = resolved[m.index + 2];
    return charBeforePlug !== "\\";
  });

  // Process in reverse order to maintain string positions
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (!match || match.index === undefined || !match[1]) continue;

    const fullMatch = match[0];
    const key = match[1];
    const startIndex = match.index;

    const slot = plugs.slots?.[key];
    const fill = plugs.fills?.[key];

    let replacement: string;
    let resolutionValue: string | undefined = undefined;
    let todo: string | undefined = undefined;

    if (fill !== undefined && fill.trim().length > 0) {
      // Case 1: Fill exists
      replacement = fill;
      resolutionValue = fill;
    } else if (slot?.required) {
      // Case 2: Required but unresolved - insert TODO
      const todoBlock = generateTODO(key, slot.example ?? undefined);
      todo = todoBlock;
      replacement = todoBlock;
      unresolvedRequired.push(key);
    } else {
      // Case 3: Optional and unresolved - replace with empty string
      replacement = "";
    }

    // Replace in text
    resolved =
      resolved.substring(0, startIndex) +
      replacement +
      resolved.substring(startIndex + fullMatch.length);

    resolutions.push({
      key,
      resolved: fill !== undefined && fill.trim().length > 0,
      value: resolutionValue,
      todo,
    });
  }

  // Step 4: Unescape - remove backslashes from [[\plug: to make [[plug:
  resolved = resolved.replace(/\[\[\\plug:/g, "[[plug:");

  // Step 5: Ensure single trailing LF
  resolved = ensureSingleTrailingLF(resolved);

  return {
    text: resolved,
    resolutions: resolutions.reverse(), // Return in original order
    unresolvedRequired,
  };
}

/**
 * Check for undeclared plug references in text
 *
 * @param text - Text to check
 * @param declaredSlots - Set of declared slot keys
 * @returns Array of undeclared plug keys
 */
export function findUndeclaredPlugs(
  text: string,
  declaredSlots: Set<string>,
): string[] {
  const plugPattern = /\[\[plug:([a-z0-9._-]+)\]\]/g;
  const undeclared: string[] = [];

  for (const match of text.matchAll(plugPattern)) {
    if (!match || !match[1]) continue;

    const key = match[1];
    if (!declaredSlots.has(key)) {
      undeclared.push(key);
    }
  }

  return [...new Set(undeclared)]; // Deduplicate
}
