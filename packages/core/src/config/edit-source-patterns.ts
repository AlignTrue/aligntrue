/**
 * Centralized mapping of exporter names to their default edit source patterns.
 *
 * This is the single source of truth for which files users can edit.
 * When adding a new exporter, add its edit source pattern here.
 *
 * Each exporter has exactly one canonical edit source file/pattern where users
 * should make edits. All other files are read-only exports.
 */

/**
 * Map of exporter name to default edit source pattern
 *
 * Used by:
 * - config defaults (packages/core/src/config/index.ts)
 * - init command (packages/cli/src/commands/init.ts)
 * - edit source detection (packages/cli/src/utils/detect-agents.ts)
 * - edit source formatting (packages/cli/src/utils/edit-source.ts)
 */
export const EXPORTER_TO_EDIT_SOURCE_PATTERN = {
  // Primary exporters
  agents: "AGENTS.md",
  cursor: ".cursor/rules/*.mdc",

  // Single-file markdown exporters
  claude: "CLAUDE.md",
  copilot: ".github/copilot-instructions.md",
  crush: "CRUSH.md",
  gemini: "GEMINI.md",
  warp: "WARP.md",
  windsurf: "WINDSURF.md",
  zed: "ZED.md",

  // Config-based exporters
  aider: ".aider.conf.yml",

  // Generic markdown exporters
  opencode: "OPENCODE.md",
  roocode: "ROOCODE.md",

  // MCP-based and other exporters (use AGENTS.md if not in map)
  // These delegate to GenericMarkdownExporter and use their primary format
} as const;

export type ExporterName = keyof typeof EXPORTER_TO_EDIT_SOURCE_PATTERN;

/**
 * Special edit source values (not tied to specific exporters)
 */
export const SPECIAL_EDIT_SOURCES = {
  /**
   * Any agent file can be edited (experimental decentralized mode)
   * Requires: centralized: false in config
   * Note: This is experimental and unsupported
   */
  ANY_AGENT_FILE: "any_agent_file",

  /**
   * Human-friendly multi-file organization
   * Use this when you want to split rules into multiple markdown files
   * Recommended for: teams, users migrating from Ruler
   */
  ALIGNTRUE_RULES: ".aligntrue/rules/*.md",
} as const;

export type SpecialEditSource =
  (typeof SPECIAL_EDIT_SOURCES)[keyof typeof SPECIAL_EDIT_SOURCES];

/**
 * Get edit source pattern for an exporter
 * Returns the default pattern or undefined if not found
 */
export function getEditSourcePattern(exporterName: string): string | undefined {
  return EXPORTER_TO_EDIT_SOURCE_PATTERN[exporterName as ExporterName];
}

/**
 * Check if a value is a valid edit source pattern
 */
export function isValidEditSource(value: unknown): value is string {
  if (typeof value !== "string") return false;

  // Check if it's a special value
  if (
    Object.values(SPECIAL_EDIT_SOURCES).includes(value as SpecialEditSource)
  ) {
    return true;
  }

  // Check if it's an exporter pattern
  if (Object.values(EXPORTER_TO_EDIT_SOURCE_PATTERN).includes(value as never)) {
    return true;
  }

  // Allow any other string pattern (custom patterns)
  return true;
}

/**
 * Get all recommended edit sources in priority order
 * For users to choose from during init
 */
export function getRecommendedEditSources(): Array<{
  value: string;
  label: string;
  description: string;
}> {
  return [
    {
      value: EXPORTER_TO_EDIT_SOURCE_PATTERN.agents,
      label: "AGENTS.md (recommended - universal format)",
      description: "Works everywhere, human-readable markdown",
    },
    {
      value: SPECIAL_EDIT_SOURCES.ALIGNTRUE_RULES,
      label: ".aligntrue/rules/ (multi-file organization)",
      description: "Split rules into multiple markdown files, better for teams",
    },
  ];
}
