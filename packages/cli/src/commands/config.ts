/**
 * Config command - Display and edit configuration
 */

import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import { spawn } from "child_process";
import { getAlignTruePaths } from "@aligntrue/core";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

/**
 * Argument definitions for config command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Config command implementation
 */
export async function config(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Extract subcommand from positional args
  const subcommand = parsed.positional[0] as
    | "show"
    | "edit"
    | "summary"
    | undefined;

  if (parsed.help || !subcommand) {
    showStandardHelp({
      name: "config",
      description: "Display or edit configuration",
      usage: "aligntrue config <subcommand>",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue config show",
        "aligntrue config edit",
        "aligntrue config summary",
      ],
      notes: [
        "Subcommands:",
        "  show     Display active configuration with mode and effective settings",
        "  edit     Open config file in default editor",
        "  summary  Display concise configuration summary",
        "",
        "Description:",
        "  The show command displays your active mode (solo/team/enterprise) and",
        "  effective configuration including defaults.",
        "",
        "  The edit command opens .aligntrue/config.yaml in your default editor.",
        "",
        "  The summary command shows a quick overview of key settings.",
      ],
    });
    process.exit(0);
    return;
  }

  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath = paths.config;

  // Check if config exists
  if (!existsSync(configPath)) {
    clack.log.error(`Config file not found: ${configPath}`);
    clack.log.info(`Run 'aligntrue init' to create initial configuration`);
    process.exit(1);
  }

  if (subcommand === "show") {
    await showConfig(configPath);
  } else if (subcommand === "edit") {
    await editConfig(configPath);
  } else if (subcommand === "summary") {
    await showSummary(configPath);
  }
}

/**
 * Show configuration with mode and effective settings
 */
async function showConfig(configPath: string): Promise<void> {
  // Wrap all output in try-catch to handle EPIPE errors gracefully
  // This occurs when output is piped to commands like grep that exit early
  try {
    clack.intro("AlignTrue Configuration");

    const { loadConfig } = await import("@aligntrue/core");
    const cfg = await loadConfig(configPath);

    // Display mode prominently
    const modeColors: Record<string, string> = {
      solo: "🟢",
      team: "🟡",
      enterprise: "🔵",
    };
    console.log(
      `\n${modeColors[cfg.mode] || "⚪"} Mode: ${cfg.mode.toUpperCase()}`,
    );

    // Display key settings
    console.log(`\n📋 Configuration:`);
    console.log(`  Version: ${cfg.version}`);
    console.log(`  Exporters: ${cfg.exporters?.join(", ") || "none"}`);

    if (cfg.sync) {
      console.log(`\n🔄 Sync:`);
      const workflowMode = cfg.sync.workflow_mode || "auto";
      console.log(`  Workflow mode: ${workflowMode}`);
      if (workflowMode === "native_format") {
        console.log(
          `    → Edit in primary agent, AlignTrue syncs automatically`,
        );
      } else if (workflowMode === "ir_source") {
        console.log(`    → Edit AGENTS.md as source of truth`);
      } else if (workflowMode === "auto") {
        console.log(`    → Auto-detects based on import source`);
      }
      console.log(`  Auto-pull: ${cfg.sync.auto_pull ?? "not set"}`);
      if (cfg.sync.primary_agent) {
        console.log(`  Primary agent: ${cfg.sync.primary_agent}`);
      }
      console.log(`  On conflict: ${cfg.sync.on_conflict || "prompt"}`);
    }

    if (cfg.modules) {
      console.log(`\n⚙️  Modules:`);
      console.log(
        `  Lockfile: ${cfg.modules.lockfile ? "enabled" : "disabled"}`,
      );
      console.log(`  Bundle: ${cfg.modules.bundle ? "enabled" : "disabled"}`);
      console.log(`  Checks: ${cfg.modules.checks ? "enabled" : "disabled"}`);
    }

    if (cfg.lockfile && cfg.modules?.lockfile) {
      console.log(`\n🔒 Lockfile:`);
      console.log(`  Mode: ${cfg.lockfile.mode || "off"}`);
    }

    if (cfg.git) {
      console.log(`\n📦 Git:`);
      console.log(`  Mode: ${cfg.git.mode || "ignore"}`);
    }

    if (cfg.scopes && cfg.scopes.length > 0) {
      console.log(`\n📍 Scopes: ${cfg.scopes.length} configured`);
    }

    console.log(`\n📝 Config file: ${configPath}`);

    clack.outro("Configuration displayed");
  } catch (_error) {
    // Handle EPIPE errors (broken pipe) gracefully - occurs when piping to grep, head, etc.
    if (
      _error instanceof Error &&
      "code" in _error &&
      _error.code === "EPIPE"
    ) {
      // Exit cleanly without error message when pipe is broken
      process.exit(0);
    }

    // Handle other errors normally
    clack.log.error(
      `Failed to load config: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }
}

/**
 * Open config file in default editor
 */
async function editConfig(configPath: string): Promise<void> {
  clack.intro("Edit Configuration");

  // Determine editor
  const editor = process.env["EDITOR"] || process.env["VISUAL"] || "vi";

  clack.log.info(`Opening ${configPath} in ${editor}`);

  return new Promise((resolve, reject) => {
    const child = spawn(editor, [configPath], {
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        clack.outro("Configuration updated");
        resolve();
      } else {
        clack.log.error(`Editor exited with code ${code}`);
        reject(new Error(`Editor exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      clack.log.error(`Failed to open editor: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Show concise configuration summary
 */
async function showSummary(configPath: string): Promise<void> {
  try {
    const { loadConfig } = await import("@aligntrue/core");
    const config = await loadConfig(configPath);

    console.log("Current configuration:");
    console.log(`  Mode: ${config.mode || "solo"}`);
    console.log(
      `  Two-way sync: ${config.sync?.two_way !== false ? "enabled" : "disabled"}`,
    );
    console.log(`  Merge strategy: last-write-wins (automatic)`);
    console.log(`  Exporters: ${config.exporters?.join(", ") || "none"}`);

    if (config.mode === "team") {
      console.log(
        `  Lockfile: ${config.modules?.lockfile ? "enabled" : "disabled"} (${config.lockfile?.mode || "soft"} mode)`,
      );
      console.log(
        `  Bundle: ${config.modules?.bundle ? "enabled" : "disabled"}`,
      );
    }

    if (config.managed?.sections && config.managed.sections.length > 0) {
      console.log(`  Team-managed sections: ${config.managed.sections.length}`);
      config.managed.sections.forEach((s) => console.log(`    - ${s}`));
    }

    console.log("\nTo change settings:");
    console.log("  Edit: .aligntrue/config.yaml");
    console.log("  Or run: aligntrue config edit");
  } catch (err) {
    clack.log.error(
      `Failed to load configuration: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}
