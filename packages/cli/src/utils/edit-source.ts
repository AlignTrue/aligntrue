/**
 * Shared helpers for formatting edit_source configuration values.
 */

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
 */
export function formatEditSourceLabel(raw: string): string {
  if (raw === "any_agent_file") {
    return "Any agent file (experimental decentralized rule management)";
  }
  if (raw === ".rules.yaml" || raw === ".aligntrue/.rules.yaml") {
    return ".aligntrue/.rules.yaml (internal IR)";
  }
  if (raw === ".cursor/rules/*.mdc") {
    return "Cursor .mdc files (.cursor/rules/*.mdc)";
  }
  return raw;
}
