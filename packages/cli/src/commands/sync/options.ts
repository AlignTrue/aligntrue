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
    description: "Bypass allow list validation in team mode (use with caution)",
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
    description: "Show detailed fidelity notes and warnings",
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
    description: "Accept all prompts (use with --accept-agent for conflicts)",
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
  yes: boolean;
  nonInteractive: boolean;
  noDetect: boolean;
  autoEnable: boolean;
  showConflicts: boolean;
}

/**
 * Parse command line arguments for sync command
 */
export function parseSyncOptions(args: string[]): SyncOptions {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

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
    verbose: (parsed.flags["verbose"] as boolean | undefined) || false,
    yes: (parsed.flags["yes"] as boolean | undefined) || false,
    nonInteractive:
      (parsed.flags["non-interactive"] as boolean | undefined) || false,
    noDetect: (parsed.flags["no-detect"] as boolean | undefined) || false,
    autoEnable: (parsed.flags["auto-enable"] as boolean | undefined) || false,
    showConflicts:
      (parsed.flags["show-conflicts"] as boolean | undefined) || false,
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
    ],
  });
}
