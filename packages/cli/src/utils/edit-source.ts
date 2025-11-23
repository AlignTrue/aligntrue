/**
 * Shared helpers for formatting edit_source configuration values.
 */

import {
  EXPORTER_TO_EDIT_SOURCE_PATTERN,
  SPECIAL_EDIT_SOURCES,
} from "@aligntrue/core/config/edit-source-patterns";

export interface EditSourceSummary {
  raw: string;
  label: string;
}

/**
 * Normalize edit_source to an array with friendly labels.
 */
export function normalizeEditSources(
  editSource: string | string[] | undefined,
): EditSourceSummary[] {
  if (!editSource || (Array.isArray(editSource) && editSource.length === 0)) {
    return [{ raw: "AGENTS.md", label: "AGENTS.md" }];
  }

  const sources = Array.isArray(editSource) ? editSource : [editSource];
  return sources.map((raw) => ({
    raw,
    label: formatEditSourceLabel(raw),
  }));
}

/**
 * Human-friendly label for edit sources.
 *
 * Handles:
 * - Special values (any_agent_file, .aligntrue/rules/*.md)
 * - Known exporter patterns (dynamically from centralized mapping)
 * - Unknown patterns (returns as-is for custom patterns)
 */
export function formatEditSourceLabel(raw: string): string {
  // Handle special values
  if (raw === SPECIAL_EDIT_SOURCES.ALIGNTRUE_RULES) {
    return ".aligntrue/rules/*.md (multi-file organization)";
  }

  // Try to find a friendly name from exporter mapping (reverse lookup)
  const exporterName = Object.entries(EXPORTER_TO_EDIT_SOURCE_PATTERN).find(
    ([_, pattern]) => pattern === raw,
  )?.[0];

  if (exporterName) {
    // Return pattern with exporter name for context
    return `${raw} (${exporterName} exporter)`;
  }

  // Fallback: return as-is for unknown patterns
  // This handles custom patterns users might set
  return raw;
}
