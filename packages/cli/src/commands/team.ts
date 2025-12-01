/**
 * Team mode management commands
 */

import { existsSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { dirname } from "path";
import { stringify as stringifyYaml } from "yaml";
import * as clack from "@clack/prompts";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { tryLoadConfig } from "../utils/config-loader.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { isTTY } from "../utils/tty-helper.js";
import { applyDefaults, getExporterNames } from "@aligntrue/core";
import { createManagedSpinner, type SpinnerLike } from "../utils/spinner.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Skip confirmation prompts (enable only)",
  },
  {
    flag: "--non-interactive",
    alias: "-n",
    hasValue: false,
    description: "Same as --yes",
  },
];

export async function team(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "team",
      description: "Manage team mode for collaborative rule management",
      usage: "aligntrue team <subcommand>",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue team enable",
        "aligntrue team enable --yes",
        "aligntrue team disable",
        "aligntrue team status",
      ],
      notes: [
        "Team mode features:",
        "  - Lockfile generation for reproducibility",
        "  - Bundle generation for multi-source merging",
        "  - Drift detection with soft/strict validation",
        "  - Git-based collaboration workflows (PR approval)",
      ],
    });
    return;
  }

  const subcommand = parsed.positional[0];

  switch (subcommand) {
    case "enable":
      await teamEnable(parsed.flags);
      break;
    case "disable":
      await teamDisable(parsed.flags);
      break;
    case "status":
      await teamStatus();
      break;
    default:
      showStandardHelp({
        name: "team",
        description: "Manage team mode for collaborative rule management",
        usage: "aligntrue team <subcommand>",
        args: ARG_DEFINITIONS,
        examples: [
          "aligntrue team enable",
          "aligntrue team enable --yes",
          "aligntrue team disable",
          "aligntrue team status",
        ],
        notes: [
          "Team mode features:",
          "  - Lockfile generation for reproducibility",
          "  - Bundle generation for multi-source merging",
          "  - Drift detection with soft/strict validation",
          "  - Git-based collaboration workflows (PR approval)",
        ],
      });
      console.error(`\nError: Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue team --help");
      process.exit(1);
  }
}

/**
 * Show team mode status dashboard
 */
async function teamStatus(): Promise<void> {
  const configPath = ".aligntrue/config.yaml";

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    // Load config
    const config = await tryLoadConfig(configPath);

    // Check if in team mode
    if (config.mode !== "team") {
      console.log("Mode: solo");
      console.log("\n💡 This project is in solo mode");
      console.log("   To enable team features, run:");
      console.log("   aligntrue team enable");
      return;
    }

    // Team mode - show full status
    console.log("Team Mode Status");
    console.log("================\n");

    // Mode
    console.log(`Mode: ${config.mode}`);

    // Lockfile status
    const lockfileEnabled = config.modules?.lockfile ?? false;
    const lockfileMode = config.lockfile?.mode ?? "off";
    if (lockfileEnabled) {
      const lockfileFriendly = formatLockfileMode(lockfileMode);
      console.log(
        `Lockfile validation: ${lockfileFriendly}${
          lockfileMode !== "off" ? ` (${lockfileMode})` : ""
        }`,
      );
      const lockfilePath = ".aligntrue.lock.json";
      const lockfileExists = existsSync(lockfilePath);
      if (lockfileExists) {
        console.log(`  File: ${lockfilePath} (exists)`);
      } else {
        console.log(`  File: ${lockfilePath} (not generated yet)`);
        console.log("  💡 Run 'aligntrue sync' to generate");
      }
      console.log("  ℹ️  Lockfile Modes:");
      console.log(
        "    off              - Generate lockfile but skip validation",
      );
      console.log("    warn on drift    - Warn about drift, but allow sync");
      console.log("    block on drift   - Block sync until lockfile approved");
    } else {
      console.log("Lockfile: disabled");
      console.log("  💡 Enable in config: modules.lockfile: true");
    }

    // Drift status
    console.log("Drift Status: Run 'aligntrue drift' to check");

    // Team members (placeholder - no git detection)
    console.log("Team Members: (configure in .aligntrue/config.yaml)");

    // Configuration section
    console.log("\nConfiguration");
    console.log("=============\n");
    console.log(`Config: ${configPath}`);

    if (lockfileEnabled) {
      console.log("Lockfile: .aligntrue.lock.json");
    }

    // Sources
    if (config.sources && config.sources.length > 0) {
      console.log(`\nSources: ${config.sources.length} configured`);
      config.sources.forEach((source, idx) => {
        let sourceStr: string;
        if (source.type === "local") {
          sourceStr = `local:${source.path}`;
        } else if (source.type === "git") {
          sourceStr = `git:${source.url}`;
        } else {
          sourceStr = source.type;
        }
        console.log(`  ${idx + 1}. ${sourceStr}`);
      });
    }

    // Exporters
    const exporterNames = getExporterNames(config.exporters);
    if (exporterNames.length > 0) {
      console.log(`\nExporters: ${exporterNames.length} configured`);
      exporterNames.forEach((exporter: string) => {
        console.log(`  - ${exporter}`);
      });
    }

    // Record telemetry
    recordEvent({ command_name: "team-status", align_hashes_used: [] });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to get team status");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function teamEnable(
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const configPath = ".aligntrue/config.yaml";
  let spinner: SpinnerLike | null = null;

  // Check for non-interactive mode
  const nonInteractive =
    (flags["yes"] as boolean | undefined) ||
    (flags["non-interactive"] as boolean | undefined) ||
    process.env["CI"] === "true" ||
    !isTTY() ||
    false;

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    // Load current config (with standardized error handling)
    const config = await tryLoadConfig(configPath);

    // Check if already in team mode
    if (config.mode === "team") {
      console.log("✓ Already in team mode");
      console.log("\nTeam mode features active:");
      console.log(
        `  - Lockfile: ${config.modules?.lockfile ? "enabled" : "disabled"}`,
      );
      console.log(
        `  - Bundle: ${config.modules?.bundle ? "enabled" : "disabled"}`,
      );
      return;
    }

    // Show what will change
    if (!nonInteractive) {
      clack.intro("Team Mode Enable");
    }

    const changes = [
      "mode: solo → team",
      "modules.lockfile: false → true",
      "modules.bundle: false → true",
    ];

    if (nonInteractive) {
      console.log("Team Mode Enable (non-interactive mode)");
      console.log("\nChanges to .aligntrue/config.yaml:");
      changes.forEach((c) => console.log(`  - ${c}`));
      console.log("\nProceeding automatically...\n");
    } else {
      clack.log.info(
        `Changes to .aligntrue/config.yaml:\n${changes.map((c) => `  - ${c}`).join("\n")}`,
      );

      const shouldProceed = await clack.confirm({
        message: "Enable team mode?",
        initialValue: true,
      });

      if (clack.isCancel(shouldProceed) || !shouldProceed) {
        clack.cancel("Team mode enable cancelled");
        return;
      }
    }

    // Create backup before making changes
    if (!nonInteractive) {
      const { BackupManager } = await import("@aligntrue/core");
      const backup = BackupManager.createBackup({
        cwd: process.cwd(),
        created_by: "team-enable",
        notes: "Before enabling team mode",
        action: "team-enable",
        mode: "solo",
      });
      clack.log.success(`Backup created: ${backup.timestamp}`);
    }

    // Update config
    config.mode = "team";
    config.modules = {
      ...config.modules,
      lockfile: true,
      bundle: true,
    };

    // Prompt for lockfile mode (interactive only)
    let lockfileMode: "soft" | "strict" = "soft";
    if (!nonInteractive) {
      // Explain team mode benefits first
      clack.log.info(`Team Mode Benefits:
  ✓ Reproducible builds with lockfiles
  ✓ Git-based collaboration workflow
  ✓ Separate team and personal rules
  ✓ Drift detection in CI
`);

      const lockfileModeResponse = await clack.select({
        message: "Lockfile validation mode:",
        options: [
          {
            value: "soft",
            label: "Soft (warn on drift, allow sync)",
            hint: "Recommended: Fast iteration, team lead approves via PR",
          },
          {
            value: "strict",
            label: "Strict (block until approved)",
            hint: "Changes blocked until team lead approves",
          },
        ],
        initialValue: "soft",
      });

      if (clack.isCancel(lockfileModeResponse)) {
        clack.cancel("Team mode setup cancelled");
        process.exit(0);
      }

      lockfileMode = lockfileModeResponse as "soft" | "strict";
    }

    // Ensure lockfile config exists and set chosen mode
    config.lockfile = {
      mode: lockfileMode,
    };

    // Preserve user-defined sources before defaults reapply
    const existingSources =
      config.sources && config.sources.length > 0
        ? config.sources.map((source) => ({ ...source }))
        : undefined;

    // Apply defaults to fill in other missing fields
    const configWithDefaults = applyDefaults(config);

    if (existingSources) {
      configWithDefaults.sources = existingSources;
    }

    spinner = createManagedSpinner();
    spinner.start("Writing team configuration");

    // Write config back atomically
    const yamlContent = stringifyYaml(configWithDefaults);
    const tempPath = `${configPath}.tmp`;

    // Ensure directory exists
    mkdirSync(dirname(configPath), { recursive: true });

    // Write to temp file first
    writeFileSync(tempPath, yamlContent, "utf-8");

    // Atomic rename (OS-level guarantee)
    renameSync(tempPath, configPath);

    // Record telemetry event
    recordEvent({ command_name: "team-enable", align_hashes_used: [] });

    // Run migration wizard for personal rules (interactive only)
    if (!nonInteractive) {
      const { runTeamMigrationWizard } = await import(
        "../wizards/team-migration.js"
      );
      await runTeamMigrationWizard(config, process.cwd());
    }

    spinner.stop("Team configuration updated");

    // Consolidated outro
    const outroLines = [
      "Team mode enabled",
      "",
      "Config updated: .aligntrue/config.yaml",
      `Lockfile: .aligntrue.lock.json (${config.lockfile?.mode || "soft"} mode, created on first sync)`,
      "",
      "Helpful commands:",
      "  aligntrue sync   Sync rules and update lockfile",
      "  aligntrue team   Manage team settings",
      "  aligntrue --help See all commands",
      "",
      "Learn more: https://aligntrue.ai/docs/team",
    ];

    if (!nonInteractive) {
      clack.outro(outroLines.join("\n"));
    } else {
      console.log("\n" + outroLines.join("\n"));
    }
  } catch (err) {
    if (spinner) {
      spinner.stop("Team mode enable failed", 1);
    }
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to enable team mode");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Disable team mode and migrate back to solo mode
 */
async function teamDisable(
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const configPath = ".aligntrue/config.yaml";
  const lockfilePath = ".aligntrue.lock.json";

  // Check for non-interactive mode
  const nonInteractive =
    (flags["yes"] as boolean | undefined) ||
    (flags["non-interactive"] as boolean | undefined) ||
    process.env["CI"] === "true" ||
    !isTTY() ||
    false;

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    // Load current config
    const config = await tryLoadConfig(configPath);

    // Check if already in solo mode
    if (config.mode !== "team") {
      console.log("✓ Already in solo mode");
      return;
    }

    // Show what will change
    if (!nonInteractive) {
      clack.intro("Team Mode Disable");
    }

    const changes = [
      "mode: team → solo",
      "modules.lockfile: true → false",
      "modules.bundle: true → false",
      "Delete .aligntrue.lock.json (no purpose in solo mode)",
      "Preserve .aligntrue/rules/ (team rules become solo public rules)",
    ];

    if (nonInteractive) {
      console.log("Team Mode Disable (non-interactive mode)");
      console.log("\nChanges:");
      changes.forEach((c) => console.log(`  - ${c}`));
      console.log("\nProceeding automatically...\n");
    } else {
      clack.log.info(`Changes:\n${changes.map((c) => `  - ${c}`).join("\n")}`);

      const shouldProceed = await clack.confirm({
        message: "Disable team mode and migrate to solo?",
        initialValue: false,
      });

      if (clack.isCancel(shouldProceed) || !shouldProceed) {
        clack.cancel("Team mode disable cancelled");
        return;
      }
    }

    // Create backup before making changes
    const { BackupManager } = await import("@aligntrue/core");
    const backup = BackupManager.createBackup({
      cwd: process.cwd(),
      created_by: "team-disable",
      notes: "Before disabling team mode",
      action: "team-disable",
      mode: "team",
    });

    if (!nonInteractive) {
      clack.log.success(`Backup created: ${backup.timestamp}`);
      clack.log.info(
        `Restore with: aligntrue backup restore --to ${backup.timestamp}`,
      );
    } else {
      console.log(`Backup created: ${backup.timestamp}`);
    }

    // Update config
    config.mode = "solo";
    config.modules = {
      ...config.modules,
      lockfile: false,
      bundle: false,
    };

    // Remove lockfile config
    if (config.lockfile) {
      delete config.lockfile;
    }

    // Apply defaults to fill in other missing fields
    const configWithDefaults = applyDefaults(config);

    // Write config back atomically
    const yamlContent = stringifyYaml(configWithDefaults);
    const tempPath = `${configPath}.tmp`;

    // Ensure directory exists
    mkdirSync(dirname(configPath), { recursive: true });

    // Write to temp file first
    writeFileSync(tempPath, yamlContent, "utf-8");

    // Atomic rename (OS-level guarantee)
    renameSync(tempPath, configPath);

    // Delete lockfile if it exists
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(lockfilePath);
      if (!nonInteractive) {
        clack.log.info("Deleted .aligntrue.lock.json");
      } else {
        console.log("Deleted .aligntrue.lock.json");
      }
    } catch {
      // File may not exist, that's fine
    }

    // Record telemetry event
    recordEvent({ command_name: "team-disable", align_hashes_used: [] });

    // Consolidated outro
    const outroLines = [
      "Solo mode enabled",
      "",
      "Your rules are in .aligntrue/rules/ - edit them any time.",
      `Backup available: aligntrue backup restore --to ${backup.timestamp}`,
      "",
      "Helpful commands:",
      "  aligntrue sync        Sync rules to your agents",
      "  aligntrue team enable Re-enable team mode",
      "  aligntrue --help      See all commands",
      "",
      "Learn more: https://aligntrue.ai/docs",
    ];

    if (!nonInteractive) {
      clack.outro(outroLines.join("\n"));
    } else {
      console.log("\n" + outroLines.join("\n"));
    }
  } catch (err) {
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to disable team mode");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function formatLockfileMode(mode: string): string {
  switch (mode) {
    case "soft":
      return "warn on drift";
    case "strict":
      return "block on drift";
    default:
      return "off";
  }
}
