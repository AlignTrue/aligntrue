/**
 * Mode marker rendering for non-Cursor exporters
 * Supports tri-state: off (no markers), metadata_only (JSON only), hints (JSON + visible intent)
 */

import type { AlignRule } from "@aligntrue/schema";
import type { ModeHints } from "@aligntrue/core";
import { canonicalJson } from "./token-budget.js";

export interface MarkerResult {
  prefix: string;
  suffix: string;
}

/**
 * Render mode markers for a rule based on mode hints setting
 *
 * @param rule The rule to generate markers for
 * @param modeHints Tri-state setting: off, metadata_only, hints, or native
 * @returns Prefix and suffix strings to wrap around rule content
 */
export function renderModeMarkers(
  rule: AlignRule,
  modeHints: ModeHints,
): MarkerResult {
  // No markers for off or native modes
  if (modeHints === "off" || modeHints === "native") {
    return { prefix: "", suffix: "" };
  }

  // Build marker object with only present fields
  const marker: Record<string, unknown> = {
    id: rule.id,
  };

  if (rule.mode) {
    marker["mode"] = rule.mode;
  }

  if (rule.applies_to && rule.applies_to.length > 0) {
    marker["applies_to"] = rule.applies_to;
  }

  if (rule.tags && rule.tags.length > 0) {
    marker["tags"] = rule.tags;
  }

  // Generate canonical JSON markers
  const begin = `<!-- aligntrue:begin ${canonicalJson(marker)} -->\n`;
  const end = `\n<!-- aligntrue:end ${canonicalJson({ id: rule.id })} -->`;

  // Metadata_only: just the markers, no visible hint
  if (modeHints === "metadata_only") {
    return { prefix: begin, suffix: end };
  }

  // Hints mode: add visible execution intent line
  const applies = rule.applies_to?.join(", ") || "**/*";
  const modeText = rule.mode ?? "manual";
  const intentVerb = {
    always: "apply automatically",
    intelligent: "apply intelligently",
    files: "apply to matching files",
    manual: "apply manually",
  }[modeText];

  const hint = `> Execution intent: ${intentVerb} when editing \`${applies}\`.\n\n`;

  return {
    prefix: begin + hint,
    suffix: end,
  };
}

/**
 * Extract mode markers from content (for import/validation)
 * Returns map of rule ID to marker data
 */
export interface ExtractedMarker {
  id: string;
  mode?: string;
  applies_to?: string[];
  tags?: string[];
  line: number;
}

export interface MarkerExtractionResult {
  markers: Map<string, ExtractedMarker>;
  errors: Array<{ line: number; message: string }>;
}

/**
 * Extract and validate marker pairs from markdown content
 * Checks that every begin marker has a matching end marker
 */
export function extractMarkerPairs(content: string): MarkerExtractionResult {
  const begins = new Map<string, ExtractedMarker>();
  const ends = new Set<string>();
  const errors: Array<{ line: number; message: string }> = [];

  // Parse begin markers
  const beginRegex = /<!--\s*aligntrue:begin\s+(\{[^}]+\})\s*-->/g;
  let match;

  while ((match = beginRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split("\n").length;

    try {
      const data = JSON.parse(match[1]!);

      if (!data.id) {
        errors.push({ line, message: "Missing id in begin marker" });
        continue;
      }

      if (begins.has(data.id)) {
        errors.push({ line, message: `Duplicate begin marker for ${data.id}` });
      }

      begins.set(data.id, { ...data, line });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Parse error";
      errors.push({ line, message: `Invalid JSON in begin marker: ${errMsg}` });
    }
  }

  // Parse end markers and validate pairing
  const endRegex = /<!--\s*aligntrue:end\s+(\{[^}]+\})\s*-->/g;

  while ((match = endRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split("\n").length;

    try {
      const data = JSON.parse(match[1]!);

      if (!data.id) {
        errors.push({ line, message: "Missing id in end marker" });
        continue;
      }

      if (!begins.has(data.id)) {
        errors.push({
          line,
          message: `End marker without matching begin: ${data.id}`,
        });
      }

      ends.add(data.id);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Parse error";
      errors.push({ line, message: `Invalid JSON in end marker: ${errMsg}` });
    }
  }

  // Check for unmatched begins
  begins.forEach((marker, id) => {
    if (!ends.has(id)) {
      errors.push({
        line: marker.line,
        message: `Begin marker without matching end: ${id}`,
      });
    }
  });

  return { markers: begins, errors };
}
