/**
 * Utilities for mapping between edit source patterns and agent names
 * This is the inverse of EXPORTER_TO_EDIT_SOURCE_PATTERN from @aligntrue/core
 */

import { EXPORTER_TO_EDIT_SOURCE_PATTERN } from "@aligntrue/core/config/edit-source-patterns";

/**
 * Create a reverse mapping from edit source patterns to exporter names
 */
function createEditSourceToExporter(): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [exporter, pattern] of Object.entries(
    EXPORTER_TO_EDIT_SOURCE_PATTERN,
  ) as Array<[string, string]>) {
    reverse[pattern] = exporter;
  }
  return reverse;
}

const EDIT_SOURCE_TO_EXPORTER = createEditSourceToExporter();

/**
 * Get the exporter/agent name for an edit source pattern
 * @param editSourcePattern - The edit source pattern (e.g., ".cursor/rules/*.mdc")
 * @returns The exporter name (e.g., "cursor") or undefined if not found
 */
export function getExporterFromEditSource(
  editSourcePattern: string | string[] | undefined,
): string | undefined {
  if (!editSourcePattern) return undefined;

  // Handle array patterns - take the first one
  const pattern = Array.isArray(editSourcePattern)
    ? editSourcePattern[0]
    : editSourcePattern;

  return pattern ? EDIT_SOURCE_TO_EXPORTER[pattern] : undefined;
}

/**
 * Get display name for an agent/exporter
 * @param agentName - The agent name (e.g., "cursor", "claude")
 * @returns Display name (e.g., "Cursor", "Claude")
 */
export function getAgentDisplayName(agentName: string): string {
  const displayNameMap: Record<string, string> = {
    agents: "AGENTS.md",
    cursor: "Cursor",
    claude: "Claude",
    copilot: "GitHub Copilot",
    crush: "Crush",
    gemini: "Gemini",
    warp: "Warp",
    windsurf: "Windsurf",
    zed: "Zed",
    amazonq: "AmazonQ",
    augmentcode: "AugmentCode",
    kilocode: "KiloCode",
    kiro: "Kiro",
    aider: "Aider",
    opencode: "OpenCode",
    roocode: "RooCode",
  };

  return displayNameMap[agentName] || agentName;
}
