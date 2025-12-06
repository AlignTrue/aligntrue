/**
 * CLI Command Manifest
 *
 * Single source of truth for command metadata.
 * Used to generate both the command registry and help text.
 */

import {
  init,
  migrate,
  sync,
  team,
  scopes,
  check,
  config,
  exporters,
  privacy,
  backup,
  revert,
  drift,
  plugs,
  onboard,
  override,
  sources,
  status,
  doctor,
  add,
  remove,
  rules,
  remotes,
  uninstall,
} from "./index.js";

/**
 * Command category for grouping in help output
 */
export type CommandCategory =
  | "getting-started"
  | "diagnostics"
  | "exporters"
  | "source"
  | "team"
  | "plugs"
  | "safety";

/**
 * Metadata for a single CLI command
 */
export interface CommandMeta {
  /** Command name (e.g., "init", "sync") */
  name: string;
  /** Short description for help text */
  summary: string;
  /** Category for grouping in help output */
  category: CommandCategory;
  /** Handler function */
  handler: (args: string[]) => Promise<void>;
}

/**
 * All CLI commands with their metadata
 *
 * Order within each category determines display order in help.
 */
export const COMMANDS: CommandMeta[] = [
  // Getting Started
  {
    name: "init",
    summary: "Initialize AlignTrue in current directory",
    category: "getting-started",
    handler: init,
  },
  {
    name: "sync",
    summary: "Sync rules to agents (always backs up first)",
    category: "getting-started",
    handler: sync,
  },
  {
    name: "check",
    summary: "Validate rules and configuration",
    category: "getting-started",
    handler: check,
  },

  // Diagnostics
  {
    name: "status",
    summary: "Show current status, exporters, and sync health",
    category: "diagnostics",
    handler: status,
  },
  {
    name: "doctor",
    summary: "Run health checks and verification tests",
    category: "diagnostics",
    handler: doctor,
  },
  {
    name: "onboard",
    summary: "Get personalized onboarding checklist",
    category: "diagnostics",
    handler: onboard,
  },

  // Exporters
  {
    name: "exporters",
    summary: "Manage exporters (list, enable, disable)",
    category: "exporters",
    handler: exporters,
  },

  // Source Management
  {
    name: "add",
    summary: "Add an align from a URL",
    category: "source",
    handler: add,
  },
  {
    name: "remove",
    summary: "Remove an align source",
    category: "source",
    handler: remove,
  },
  {
    name: "sources",
    summary: "Manage multi-file rule organization (experimental)",
    category: "source",
    handler: sources,
  },
  {
    name: "rules",
    summary: "List rules and view agent targeting",
    category: "source",
    handler: rules,
  },
  {
    name: "remotes",
    summary: "Manage remote destinations (status, push)",
    category: "source",
    handler: remotes,
  },
  {
    name: "scopes",
    summary: "Manage scopes (list, discover)",
    category: "source",
    handler: scopes,
  },

  // Team Commands
  {
    name: "team",
    summary: "Team mode management (enable, join, disable, status)",
    category: "team",
    handler: team,
  },
  {
    name: "drift",
    summary: "Detect drift from allowed sources",
    category: "team",
    handler: drift,
  },
  {
    name: "override",
    summary: "Manage overlays for fork-safe customization (experimental)",
    category: "team",
    handler: override,
  },

  // Plugs Management
  {
    name: "plugs",
    summary:
      "Manage plug slots and fills (list, resolve, validate) (experimental)",
    category: "plugs",
    handler: plugs,
  },

  // Safety & Settings
  {
    name: "config",
    summary: "View or edit configuration (show, edit)",
    category: "safety",
    handler: config,
  },
  {
    name: "backup",
    summary: "Manage backups (create, list, restore, cleanup)",
    category: "safety",
    handler: backup,
  },
  {
    name: "revert",
    summary: "Restore files from backup with preview",
    category: "safety",
    handler: revert,
  },
  {
    name: "privacy",
    summary: "Privacy and consent management (audit, revoke)",
    category: "safety",
    handler: privacy,
  },
  {
    name: "migrate",
    summary: "Schema migration (run --help for policy)",
    category: "safety",
    handler: migrate,
  },
  {
    name: "uninstall",
    summary: "Remove AlignTrue from this project",
    category: "safety",
    handler: uninstall,
  },
];

/**
 * Category display metadata
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  "getting-started": "Getting Started",
  diagnostics: "Diagnostics",
  exporters: "Exporters",
  source: "Source Management",
  team: "Team Commands",
  plugs: "Plugs Management",
  safety: "Safety & Settings",
};

/**
 * Build a Map for command dispatch
 */
export function buildCommandRegistry(): Map<
  string,
  (args: string[]) => Promise<void>
> {
  return new Map(COMMANDS.map((cmd) => [cmd.name, cmd.handler]));
}

/**
 * Generate help text from command manifest
 */
export function generateHelpText(): string {
  const lines: string[] = [
    "AlignTrue CLI - AI-native rules and alignment platform",
    "",
    "Usage: aligntrue <command> [options]",
    "",
  ];

  // Group commands by category
  const byCategory = new Map<CommandCategory, CommandMeta[]>();
  for (const cmd of COMMANDS) {
    if (!byCategory.has(cmd.category)) {
      byCategory.set(cmd.category, []);
    }
    byCategory.get(cmd.category)!.push(cmd);
  }

  // Calculate max command name length for alignment
  const maxNameLen = Math.max(...COMMANDS.map((c) => c.name.length));

  // Output each category in order
  const categoryOrder: CommandCategory[] = [
    "getting-started",
    "diagnostics",
    "exporters",
    "source",
    "team",
    "plugs",
    "safety",
  ];

  for (const category of categoryOrder) {
    const commands = byCategory.get(category);
    if (!commands || commands.length === 0) continue;

    lines.push(`${CATEGORY_LABELS[category]}:`);
    for (const cmd of commands) {
      const padding = " ".repeat(maxNameLen - cmd.name.length + 2);
      lines.push(`  ${cmd.name}${padding}${cmd.summary}`);
    }
    lines.push("");
  }

  lines.push("Run aligntrue <command> --help for command-specific options");
  lines.push("Run aligntrue --version for version information");

  return lines.join("\n");
}
