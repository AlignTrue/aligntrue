/**
 * Sync command options and argument parsing
 */

import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../../utils/command-utilities.js";

/**
 * Argument definitions for sync command
 */
export const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--dry-run",
    hasValue: false,
    description: "Preview changes without writing files",
  },
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path (default: .aligntrue/config.yaml)",
  },
  {
    flag: "--accept-agent",
    hasValue: true,
    description: "Pull changes from agent back to IR",
  },
  {
    flag: "--no-auto-pull",
    hasValue: false,
    description: "Disable auto-pull for this sync",
  },
  {
    flag: "--show-auto-pull-diff",
    hasValue: false,
    description: "Show full diff when auto-pull executes",
  },
  {
    flag: "--force",
    hasValue: false,
    description:
      "Bypass validation and force overwrite edit_source files with manual edits (read-only files auto-overwrite with backup)",
  },
  {
    flag: "--force-invalid-ir",
    hasValue: false,
    description: "Allow sync even with IR validation errors (not recommended)",
  },
  {
    flag: "--force-refresh",
    hasValue: false,
    description: "Force check all git sources for updates (bypass TTL)",
  },
  {
    flag: "--skip-update-check",
    hasValue: false,
    description: "Skip git source update checks, use cache only",
  },
  {
    flag: "--offline",
    hasValue: false,
    description: "Offline mode: use cache, no network calls",
  },
  {
    flag: "--verbose",
    hasValue: false,
    description:
      "Show detailed fidelity notes and warnings (can be used twice: -vv)",
  },
  {
    flag: "--json",
    hasValue: false,
    description: "Output in JSON format (for scripting/CI)",
  },
  {
    flag: "--quiet",
    alias: "-q",
    hasValue: false,
    description: "Minimal output (errors and final result only)",
  },
  {
    flag: "--no-detect",
    hasValue: false,
    description: "Skip agent detection",
  },
  {
    flag: "--auto-enable",
    hasValue: false,
    description: "Auto-enable detected agents without prompting",
  },
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description:
      "Accept all prompts including file overwrite conflicts (use with --accept-agent for conflicts)",
  },
  {
    flag: "--non-interactive",
    alias: "-n",
    hasValue: false,
    description: "Run without prompts (uses defaults)",
  },
  {
    flag: "--show-conflicts",
    hasValue: false,
    description: "Show detailed conflict information with section content",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Parsed sync options
 */
export interface SyncOptions {
  help: boolean;
  dryRun: boolean;
  configPath: string | undefined;
  acceptAgent: string | undefined;
  force: boolean;
  forceInvalidIR: boolean;
  forceRefresh: boolean;
  skipUpdateCheck: boolean;
  offline: boolean;
  verbose: boolean;
  verboseFull: boolean; // True if -vv or --verbose multiple times
  quiet: boolean;
  yes: boolean;
  nonInteractive: boolean;
  noDetect: boolean;
  autoEnable: boolean;
  showConflicts: boolean;
  json?: boolean; // For structured output
  editSourceMergeStrategy?: "keep-both" | "keep-new" | "keep-existing"; // Set during sync when edit source changes
}

/**
 * Parse command line arguments for sync command
 */
export function parseSyncOptions(args: string[]): SyncOptions {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Check for multiple -v flags (e.g., -vv for full verbosity)
  // Count consecutive -v in args (not parsing as separate flags)
  let verboseFull = false;
  let verboseCount = 0;
  for (const arg of args) {
    if (arg === "-v" || arg === "-vv" || arg === "-vvv") {
      verboseCount += arg.length - 1; // Count the v's
    }
  }
  verboseFull = verboseCount >= 2;

  return {
    help: parsed.help,
    dryRun: (parsed.flags["dry-run"] as boolean | undefined) || false,
    configPath: parsed.flags["config"] as string | undefined,
    acceptAgent: parsed.flags["accept-agent"] as string | undefined,
    force: (parsed.flags["force"] as boolean | undefined) || false,
    forceInvalidIR:
      (parsed.flags["force-invalid-ir"] as boolean | undefined) || false,
    forceRefresh:
      (parsed.flags["force-refresh"] as boolean | undefined) || false,
    skipUpdateCheck:
      (parsed.flags["skip-update-check"] as boolean | undefined) || false,
    offline: (parsed.flags["offline"] as boolean | undefined) || false,
    verbose:
      (parsed.flags["verbose"] as boolean | undefined) || verboseCount >= 1,
    verboseFull,
    quiet: (parsed.flags["quiet"] as boolean | undefined) || false,
    yes: (parsed.flags["yes"] as boolean | undefined) || false,
    nonInteractive:
      (parsed.flags["non-interactive"] as boolean | undefined) || false,
    noDetect: (parsed.flags["no-detect"] as boolean | undefined) || false,
    autoEnable: (parsed.flags["auto-enable"] as boolean | undefined) || false,
    showConflicts:
      (parsed.flags["show-conflicts"] as boolean | undefined) || false,
    json: (parsed.flags["json"] as boolean | undefined) || false,
  };
}

/**
 * Show help text for sync command
 */
export function showSyncHelp(): void {
  showStandardHelp({
    name: "sync",
    description: "Sync rules from IR to configured agents (default direction)",
    usage: "aligntrue sync [options]",
    args: ARG_DEFINITIONS,
    examples: [
      "aligntrue sync",
      "aligntrue sync --dry-run",
      "aligntrue sync --config custom/config.yaml",
      "aligntrue sync --accept-agent cursor",
    ],
    notes: [
      "Description:",
      "  Loads rules from configured sources (local files, git repositories),",
      "  resolves scopes, merges multiple sources if configured, and syncs to",
      "  configured agent exporters (Cursor, AGENTS.md, VS Code MCP, etc.).",
      "",
      "  Supports:",
      "  - Local sources: .aligntrue/.rules.yaml or custom paths",
      "  - Git sources: remote repositories with automatic caching",
      "  - Multiple sources: automatic bundle merging with conflict resolution",
      "",
      "  In team mode with lockfile enabled, validates lockfile before syncing.",
      "",
      "  Default direction: IR → agents (internal IR to agent config files)",
      "  Pullback direction: agents → IR (with --accept-agent flag or auto-pull enabled)",
      "",
      "Agent Detection:",
      "  Automatically detects new agents in workspace and prompts to enable them.",
      "  Use --no-detect to skip detection or --auto-enable to enable without prompting.",
      "",
      "Edit Source Management:",
      "  When multi-file agent formats (e.g., Cursor) are detected with a single-file",
      "  edit source (e.g., AGENTS.md), sync will recommend switching to the multi-file",
      "  format to preserve file organization. Previous edit source is backed up.",
      "",
      "Output Modes:",
      "  Default: Compact summary of detected content with hint to use --verbose",
      "  --verbose: Show top files for each agent, useful for review",
      "  --verbose --verbose (-vv): Show all files with full details",
      "  --json: Machine-readable JSON output for scripting/CI",
      "",
      "Overwritten Rules Safety:",
      "  Manual edits are automatically backed up before overwriting:",
      "  - File backups: .aligntrue/overwritten-rules/ (with timestamp)",
      "  - Section conflicts: .aligntrue/overwritten-rules.md (with metadata)",
      "  - Happens automatically for read-only files (no --force needed)",
      "  - These can be reviewed and deleted at any time.",
    ],
  });
}
