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
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import * as clack from "@clack/prompts";
import { tryLoadConfig } from "../utils/config-loader.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { isTTY } from "../utils/tty-helper.js";
import {
  getExporterNames,
  getAlignTruePaths,
  isTeamModeActive,
  hasTeamModeOffMarker,
  TEAM_MODE_OFF_MARKER,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { addToGitignore } from "../utils/gitignore-helpers.js";

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
  const paths = getAlignTruePaths(process.cwd());
  const configPath = paths.config;
  const teamConfigPath = paths.teamConfig;

  // Check if config exists
  if (!existsSync(configPath) && !existsSync(teamConfigPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    const teamModeActive = isTeamModeActive(process.cwd());
    const hasOffMarker = hasTeamModeOffMarker(process.cwd());

    // Check if in team mode
    if (!teamModeActive) {
      console.log("Mode: solo");
      if (hasOffMarker) {
        console.log("\n💡 Team config exists but is disabled");
        console.log("   config.team.yaml has OFF marker");
        console.log("   To re-enable team features, run:");
        console.log("   aligntrue team enable");
      } else {
        console.log("\n💡 This project is in solo mode");
        console.log("   To enable team features, run:");
        console.log("   aligntrue team enable");
      }
      return;
    }

    // Load merged config for team mode
    const { loadMergedConfig } = await import("@aligntrue/core");
    const { config, sources: configSources } = await loadMergedConfig(
      process.cwd(),
    );

    // Team mode - show full status
    console.log("Team Mode Status");
    console.log("================\n");

    // Mode and config files
    console.log(`Mode: team`);
    console.log("\nConfig Files:");
    console.log(`  Team: ${teamConfigPath} (committed)`);
    if (configSources.personal) {
      console.log(`  Personal: ${configPath} (gitignored)`);
    } else {
      console.log(`  Personal: ${configPath} (not created yet)`);
    }

    // Lockfile status
    const lockfileEnabled = config.modules?.lockfile ?? false;
    const lockfileMode = config.lockfile?.mode ?? "off";
    if (lockfileEnabled) {
      const lockfileFriendly = formatLockfileMode(lockfileMode);
      console.log(
        `\nLockfile validation: ${lockfileFriendly}${
          lockfileMode !== "off" ? ` (${lockfileMode})` : ""
        }`,
      );
      const lockfilePath = paths.lockfile;
      const lockfileExists = existsSync(lockfilePath);
      if (lockfileExists) {
        console.log(`  File: .aligntrue/lock.json (exists)`);
      } else {
        console.log(`  File: .aligntrue/lock.json (not generated yet)`);
        console.log("  💡 Run 'aligntrue sync' to generate");
      }
      console.log("  ℹ️  Lockfile Modes:");
      console.log(
        "    off              - Generate lockfile but skip validation",
      );
      console.log("    warn on drift    - Warn about drift, but allow sync");
      console.log("    block on drift   - Block sync until lockfile approved");
    } else {
      console.log("\nLockfile: disabled");
      console.log("  💡 Enable in team config: modules.lockfile: true");
    }

    // Drift status
    console.log("\nDrift Status: Run 'aligntrue drift' to check");

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
        const personalTag = source.personal ? " (personal)" : "";
        console.log(`  ${idx + 1}. ${sourceStr}${personalTag}`);
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

    // Remotes
    if (config.remotes) {
      console.log("\nRemotes:");
      if (config.remotes.personal) {
        const url =
          typeof config.remotes.personal === "string"
            ? config.remotes.personal
            : config.remotes.personal.url;
        console.log(`  Personal: ${url}`);
      }
      if (config.remotes.shared) {
        const url =
          typeof config.remotes.shared === "string"
            ? config.remotes.shared
            : config.remotes.shared.url;
        console.log(`  Shared: ${url}`);
      }
    }
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
  const paths = getAlignTruePaths(process.cwd());
  const configPath = paths.config;
  const teamConfigPath = paths.teamConfig;

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
    // Check if team mode is already active
    if (isTeamModeActive(process.cwd())) {
      const config = await tryLoadConfig(configPath);
      console.log("✓ Already in team mode");
      console.log("\nTeam mode features active:");
      console.log(
        `  - Lockfile: ${config.modules?.lockfile ? "enabled" : "disabled"}`,
      );
      return;
    }

    // Check if team config exists but has OFF marker (re-enabling)
    const isReEnabling = hasTeamModeOffMarker(process.cwd());

    // Show what will change
    if (!nonInteractive) {
      clack.intro("Team Mode Enable");
    }

    const changes = isReEnabling
      ? [
          "Re-enable team config (remove OFF marker from config.team.yaml)",
          "Lockfile generation will resume",
        ]
      : [
          "Create config.team.yaml with team settings",
          "Add config.yaml to .gitignore (personal settings)",
          "Generate lockfile for reproducibility",
        ];

    if (nonInteractive) {
      console.log("Team Mode Enable (non-interactive mode)");
      console.log("\nChanges:");
      changes.forEach((c) => console.log(`  - ${c}`));
      console.log("\nProceeding automatically...\n");
    } else {
      clack.log.info(`Changes:\n${changes.map((c) => `  - ${c}`).join("\n")}`);

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

    // Prompt for lockfile mode (interactive only, new setup only)
    let lockfileMode: "soft" | "strict" = "soft";
    if (!nonInteractive && !isReEnabling) {
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

    if (isReEnabling) {
      // Re-enabling: just remove the OFF marker from config.team.yaml
      const content = readFileSync(teamConfigPath, "utf-8");
      const markerEnd = content.indexOf("\n");
      const configContent =
        markerEnd !== -1 ? content.slice(markerEnd + 1) : "";
      writeFileSync(teamConfigPath, configContent, "utf-8");

      if (!nonInteractive) {
        clack.log.success("Team mode re-enabled (removed OFF marker)");
      }
    } else {
      // New setup: create config.team.yaml and update config.yaml

      // Load current personal config to extract team-only fields
      const personalRaw = parseYaml(
        readFileSync(configPath, "utf-8"),
      ) as Record<string, unknown>;

      // Extract team-only fields for team config
      const teamConfig: Partial<AlignTrueConfig> = {
        mode: "team",
        modules: {
          lockfile: true,
        },
        lockfile: {
          mode: lockfileMode,
        },
      };

      // Move sources to team config (team-owned inputs)
      const rawSources = personalRaw["sources"];
      if (rawSources !== undefined && rawSources !== null) {
        teamConfig.sources = rawSources as NonNullable<
          AlignTrueConfig["sources"]
        >;
      }

      // Write team config
      const teamYaml = stringifyYaml(teamConfig);
      mkdirSync(dirname(teamConfigPath), { recursive: true });
      writeFileSync(teamConfigPath, teamYaml, "utf-8");

      // Clean personal config: remove team-only fields
      const cleanedPersonal: Record<string, unknown> = {};
      const teamOnlyFields = ["mode", "modules", "lockfile", "sources"];
      for (const [key, value] of Object.entries(personalRaw)) {
        if (!teamOnlyFields.includes(key) && value !== undefined) {
          cleanedPersonal[key] = value;
        }
      }

      // Keep version in personal for reference
      if (personalRaw["version"]) {
        cleanedPersonal["version"] = personalRaw["version"];
      }

      // Write cleaned personal config
      const personalYaml = stringifyYaml(cleanedPersonal);
      const tempPath = `${configPath}.tmp`;
      writeFileSync(tempPath, personalYaml, "utf-8");
      renameSync(tempPath, configPath);

      // Add config.yaml to .gitignore
      await addToGitignore(
        "config.yaml",
        "AlignTrue personal config",
        process.cwd(),
      );

      if (!nonInteractive) {
        clack.log.success("Created config.team.yaml with team settings");
        clack.log.success("Updated config.yaml (personal settings only)");
        clack.log.success("Added config.yaml to .gitignore");
      }
    }

    // Create empty lockfile immediately (for new setup or re-enable)
    const { createEmptyLockfile } = await import(
      "../utils/lockfile-helpers.js"
    );
    const lockfileResult = await createEmptyLockfile(process.cwd(), "team");

    if (!lockfileResult.success && lockfileResult.error) {
      // Log warning but don't fail - lockfile will be created on first sync
      if (!nonInteractive) {
        clack.log.warn(
          `Could not create lockfile: ${lockfileResult.error}. It will be created on first sync.`,
        );
      } else {
        console.warn(
          `Could not create lockfile: ${lockfileResult.error}. It will be created on first sync.`,
        );
      }
    }

    // Consolidated outro
    const outroLines = [
      "Team mode enabled",
      "",
      "Team config: .aligntrue/config.team.yaml (commit this)",
      "Personal config: .aligntrue/config.yaml (gitignored)",
      `Lockfile: .aligntrue/lock.json (${lockfileMode} mode, ready)`,
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
 * Disable team mode (non-destructive: adds OFF marker to config.team.yaml)
 */
async function teamDisable(
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const paths = getAlignTruePaths(process.cwd());
  const teamConfigPath = paths.teamConfig;

  // Check for non-interactive mode
  const nonInteractive =
    (flags["yes"] as boolean | undefined) ||
    (flags["non-interactive"] as boolean | undefined) ||
    process.env["CI"] === "true" ||
    !isTTY() ||
    false;

  // Check if team mode is active
  if (!isTeamModeActive(process.cwd())) {
    console.log("✓ Already in solo mode");
    if (hasTeamModeOffMarker(process.cwd())) {
      console.log("  (config.team.yaml exists but is marked OFF)");
    }
    return;
  }

  try {
    // Show what will change
    if (!nonInteractive) {
      clack.intro("Team Mode Disable");
    }

    const changes = [
      "Add OFF marker to config.team.yaml (preserves all settings)",
      "Team config will be ignored until re-enabled",
      "Your team settings are preserved for easy re-enable",
    ];

    if (nonInteractive) {
      console.log("Team Mode Disable (non-interactive mode)");
      console.log("\nChanges:");
      changes.forEach((c) => console.log(`  - ${c}`));
      console.log("\nProceeding automatically...\n");
    } else {
      clack.log.info(`Changes:\n${changes.map((c) => `  - ${c}`).join("\n")}`);

      const shouldProceed = await clack.confirm({
        message: "Disable team mode?",
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
    } else {
      console.log(`Backup created: ${backup.timestamp}`);
    }

    // Add OFF marker to the top of config.team.yaml (non-destructive)
    const existingContent = readFileSync(teamConfigPath, "utf-8");
    const newContent = `${TEAM_MODE_OFF_MARKER}\n${existingContent}`;
    writeFileSync(teamConfigPath, newContent, "utf-8");

    if (!nonInteractive) {
      clack.log.success("Added OFF marker to config.team.yaml");
    }

    // Consolidated outro
    const outroLines = [
      "Team mode disabled",
      "",
      "config.team.yaml is now ignored (settings preserved)",
      "Personal config.yaml is still active",
      "",
      "To re-enable team mode:",
      "  aligntrue team enable",
      "",
      "Your team settings are preserved and can be restored instantly.",
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
