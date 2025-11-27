/**
 * Sync command options and argument parsing
 */

import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../../utils/command-utilities.js";
import type { SyncOptions } from "@aligntrue/plugin-contracts";

// Re-export SyncOptions for use by other CLI modules
export type { SyncOptions };

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
    flag: "--force",
    hasValue: false,
    description: "Force overwrite files even if they have local changes",
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
    flag: "--skip-not-found-warning",
    hasValue: false,
    description:
      "Skip warning about configured exporters not being detected (used during init)",
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
    description: "Accept all prompts including file overwrite conflicts",
  },
  {
    flag: "--non-interactive",
    alias: "-n",
    hasValue: false,
    description: "Run without prompts (uses defaults)",
  },
  {
    flag: "--clean",
    hasValue: false,
    description: "Remove exported files that have no matching source rule",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

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

  // Build options object, only including optional properties when they have defined values
  const opts: SyncOptions = {
    help: parsed.help,
    dryRun: (parsed.flags["dry-run"] as boolean | undefined) || false,
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
    skipNotFoundWarning:
      (parsed.flags["skip-not-found-warning"] as boolean | undefined) || false,
    json: (parsed.flags["json"] as boolean | undefined) || false,
    clean: (parsed.flags["clean"] as boolean | undefined) || false,
  };

  // Conditionally add optional string properties
  const configPath = parsed.flags["config"] as string | undefined;
  if (configPath !== undefined) {
    opts.configPath = configPath;
  }

  return opts;
}

/**
 * Show help text for sync command
 */
export function showSyncHelp(): void {
  showStandardHelp({
    name: "sync",
    description:
      "Sync rules from .aligntrue/rules/ to configured agents (unidirectional)",
    usage: "aligntrue sync [options]",
    args: ARG_DEFINITIONS,
    examples: [
      "aligntrue sync",
      "aligntrue sync --dry-run",
      "aligntrue sync --config custom/config.yaml",
      "aligntrue sync --verbose",
    ],
    notes: [
      "Description:",
      "  Loads rules from .aligntrue/rules/*.md (the single source of truth),",
      "  and exports them to configured agent formats (Cursor, AGENTS.md, etc.).",
      "",
      "  The .aligntrue/rules/ directory is the canonical source for all rules.",
      "  Edit rules directly in .aligntrue/rules/*.md, then run sync to export.",
      "",
      "  Supports:",
      "  - Local rules: .aligntrue/rules/*.md files",
      "  - Git sources: remote repositories with automatic caching",
      "  - Nested directories: auto-detected and mirrored to agent formats",
      "",
      "  In team mode with lockfile enabled, validates lockfile before syncing.",
      "",
      "Agent Detection:",
      "  Automatically detects agents in workspace and prompts to enable them.",
      "  Use --no-detect to skip detection or --auto-enable to enable without prompting.",
      "",
      "Output Modes:",
      "  Default: Compact summary of exported content",
      "  --verbose: Show files for each agent, useful for review",
      "  --verbose --verbose (-vv): Show all files with full details",
      "  --json: Machine-readable JSON output for scripting/CI",
      "",
      "Safety:",
      "  A backup is created before each sync operation.",
      "  Restore with: aligntrue backup restore --to <timestamp>",
    ],
  });
}
