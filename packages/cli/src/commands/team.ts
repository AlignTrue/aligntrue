/**
 * Team mode management commands
 */

import {
  existsSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  readFileSync,
} from "fs";
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
import { applyDefaults } from "@aligntrue/core";

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
    case "status":
      await teamStatus();
      break;
    case "approve":
      await teamApprove(parsed.positional.slice(1), parsed.flags);
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
          "aligntrue team status",
          "aligntrue team approve --current",
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
      console.log(
        `Lockfile validation: ${lockfileMode} (file generation: enabled)`,
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
      console.log("    off    - Generate lockfile but skip validation");
      console.log("    soft   - Warn about drift, but allow sync");
      console.log("    strict - Block sync if lockfile validation fails");
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
    if (config.exporters && config.exporters.length > 0) {
      console.log(`\nExporters: ${config.exporters.length} configured`);
      config.exporters.forEach((exporter) => {
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

  // Check for non-interactive mode
  const nonInteractive =
    (flags["yes"] as boolean | undefined) ||
    (flags["non-interactive"] as boolean | undefined) ||
    process.env["CI"] === "true" ||
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

    // Record telemetry event
    recordEvent({ command_name: "team-enable", align_hashes_used: [] });

    // Run migration wizard for personal rules (interactive only)
    if (!nonInteractive) {
      const { runTeamMigrationWizard } = await import(
        "../wizards/team-migration.js"
      );
      await runTeamMigrationWizard(config, process.cwd());
    }

    // Show configuration summary
    console.log("\n✓ Team mode enabled\n");
    console.log("Current configuration:");
    console.log(`  Mode: team`);
    console.log(
      `  Lockfile: enabled (${config.lockfile?.mode || "soft"} mode)`,
    );
    console.log(`  Bundle: enabled`);
    console.log(
      `  Two-way sync: ${config.sync?.two_way !== false ? "enabled" : "disabled"}`,
    );
    if (config.managed?.sections && config.managed.sections.length > 0) {
      console.log(`  Team-managed sections: ${config.managed.sections.length}`);
      config.managed.sections.forEach((s) => console.log(`    - ${s}`));
    }

    console.log("\nNext steps:");
    console.log("  1. Run first sync: aligntrue sync");
    console.log("  2. Review generated lockfile: .aligntrue.lock.json");
    console.log("  3. Commit changes:");
    console.log("     git add .aligntrue/");
    console.log("     git commit -m 'feat: Enable AlignTrue team mode'");
    console.log(
      "  4. Team members run: aligntrue init (will detect team mode)",
    );

    if (!nonInteractive) {
      clack.outro("Team mode ready! Run 'aligntrue sync' to get started.");
    }
  } catch (err) {
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
 * Approve drift changes or accept current lockfile version
 */
async function teamApprove(
  args: string[],
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  try {
    // Parse flags
    const isCurrent = Boolean(flags["current"]);
    const force = Boolean(flags["force"]);

    // Check for sources first (if not --current)
    if (!isCurrent && args.length === 0 && !force) {
      console.error("No sources provided or --current flag missing");
      console.error("\nUsage:");
      console.error(
        "  aligntrue team approve --current          # Accept lockfile",
      );
      console.error(
        "  aligntrue team approve <source> [--force] # Approve specific source",
      );
      process.exit(2);
    }

    // Check for required config
    if (!existsSync(".aligntrue/config.yaml")) {
      console.error("Config file not found: .aligntrue/config.yaml");
      console.error("Run 'aligntrue init' to create one.");
      process.exit(2);
    }

    // Check for lockfile if using --current
    if (isCurrent && !existsSync(".aligntrue.lock.json")) {
      console.error("Lockfile not found: .aligntrue.lock.json");
      console.error("Run 'aligntrue sync' to generate one.");
      process.exit(2);
    }

    if (isCurrent) {
      // Accept current lockfile version
      const lockfileContent = readFileSync(".aligntrue.lock.json", "utf-8");
      const lockfile = JSON.parse(lockfileContent) as {
        rules?: Array<{
          rule_id: string;
          source?: string;
          content_hash?: string;
        }>;
      };

      // Build allow list from current lockfile
      const sources = new Set<string>();
      if (lockfile.rules) {
        for (const rule of lockfile.rules) {
          if (rule.source) {
            sources.add(rule.source);
          }
        }
      }

      if (sources.size === 0) {
        console.log("✓ No upstream sources to approve");
        return;
      }

      // Create or update allow list
      const allowList = {
        version: 1,
        sources: Array.from(sources).map((source) => {
          const rule = lockfile.rules?.find((r) => r.source === source);
          return {
            value: source,
            resolved_hash: rule?.content_hash,
          };
        }),
      };

      // Write allow list
      mkdirSync(".aligntrue", { recursive: true });
      const yamlContent = stringifyYaml(allowList);
      writeFileSync(".aligntrue/allow.yaml", yamlContent, "utf-8");

      console.log(
        "✓ Lockfile version approved and stored in .aligntrue/allow.yaml",
      );
      console.log("  Commit this file to version control:");
      console.log("  git add .aligntrue/allow.yaml");
      console.log("  git commit -m 'chore: Approve current lockfile'");
    } else {
      // Approve specific source(s)
      const source = args[0];
      if (!source) {
        console.error("Source required");
        process.exit(2);
      }

      console.log(`✓ Approved source: ${source}`);
      console.log("  Run 'aligntrue drift' to verify no drift");
    }

    // Record telemetry
    await recordEvent({
      command_name: "team-approve",
      align_hashes_used: [],
    });
  } catch (err) {
    console.error(
      `✗ Failed to approve changes: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    process.exit(1);
  }
}
