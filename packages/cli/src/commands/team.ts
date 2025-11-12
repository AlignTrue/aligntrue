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
import {
  parseAllowList,
  addSourceToAllowList,
  removeSourceFromAllowList,
  writeAllowList,
} from "@aligntrue/core/team/allow.js";
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
  {
    flag: "--current",
    hasValue: false,
    description: "Approve current bundle hash from lockfile",
  },
  {
    flag: "--preview",
    hasValue: false,
    description: "Show diff before approving (approve only)",
  },
  {
    flag: "--no-preview",
    hasValue: false,
    description: "Skip diff preview in interactive mode (approve only)",
  },
];
const ALLOW_LIST_PATH = ".aligntrue/allow.yaml";

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
        "aligntrue team approve --current",
        "aligntrue team approve sha256:abc123...",
        "aligntrue team list-allowed",
        "aligntrue team remove sha256:abc123...",
      ],
      notes: [
        "Team mode features:",
        "  - Lockfile generation for reproducibility",
        "  - Bundle generation for multi-source merging",
        "  - Drift detection with soft/strict validation",
        "  - Git-based collaboration workflows",
        "  - Allow list for approved rule sources",
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
    case "list-allowed":
      await teamListAllowed();
      break;
    case "remove":
      await teamRemove(parsed.positional.slice(1));
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
          "aligntrue team approve sha256:abc123...",
          "aligntrue team list-allowed",
          "aligntrue team remove sha256:abc123...",
        ],
        notes: [
          "Team mode features:",
          "  - Lockfile generation for reproducibility",
          "  - Bundle generation for multi-source merging",
          "  - Drift detection with soft/strict validation",
          "  - Git-based collaboration workflows",
          "  - Allow list for approved rule sources",
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
      console.log(
        "    soft   - Warn about drift and unapproved hashes, but allow sync",
      );
      console.log(
        "    strict - Block sync if lockfile validation fails or hash not approved",
      );
    } else {
      console.log("Lockfile: disabled");
      console.log("  💡 Enable in config: modules.lockfile: true");
    }

    // Allow list status
    const allowListExists = existsSync(ALLOW_LIST_PATH);
    if (allowListExists) {
      try {
        const allowList = parseAllowList(ALLOW_LIST_PATH);
        const count = allowList.sources.length;
        console.log(
          `Allow List: ${count} source${count !== 1 ? "s" : ""} approved`,
        );
        console.log(`  File: ${ALLOW_LIST_PATH}`);
      } catch (err) {
        console.log("Allow List: exists but failed to parse");
        console.log(
          `  Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      console.log("Allow List: not configured");
      console.log("  💡 Run 'aligntrue team approve <source>' to create");
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

    if (allowListExists) {
      console.log(`Allow List: ${ALLOW_LIST_PATH}`);
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

    // Set default approval to pr_approval (relaxed)
    if (!config.approval) {
      config.approval = {
        internal: "pr_approval",
        external: "allowlist",
      };
    }

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
      `  Approval: ${config.approval?.internal || "pr_approval"} (internal), ${config.approval?.external || "allowlist"} (external)`,
    );
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
 * Approve git source update - force refresh and add to allow list
 */
async function approveGitSource(
  _url: string,
  _flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  clack.intro(`Approve Git Source: ${_url}`);

  try {
    // Load config to get mode
    const configPath = ".aligntrue/config.yaml";

    if (!existsSync(configPath)) {
      console.error("✗ Config not found");
      console.error("  Run: aligntrue init");
      process.exit(1);
    }

    const { loadConfig } = await import("@aligntrue/core");
    const config = await loadConfig(configPath);

    if (config.mode !== "team") {
      console.error("✗ Team mode not enabled");
      console.error("  Run: aligntrue team enable");
      process.exit(1);
    }

    // Find the git source in config
    const gitSource = config.sources?.find(
      (s) => s.type === "git" && s.url === _url,
    );

    if (!gitSource) {
      console.error(`✗ Git source not found in config: ${_url}`);
      console.error("  Add the source to config first:");
      console.error(`  aligntrue pull ${_url} --save`);
      process.exit(1);
    }

    // Force refresh the source
    const spinner = clack.spinner();
    spinner.start("Pulling latest from git source...");

    const { GitProvider } = await import("@aligntrue/sources");

    const gitConfig = {
      type: "git" as const,
      url: gitSource.url || _url,
      ref: gitSource.ref || "main",
      path: gitSource.path || ".aligntrue.yaml",
      forceRefresh: true,
    };

    const provider = new GitProvider(
      {
        ...gitConfig,
        checkInterval: 0, // Force immediate check
      },
      ".aligntrue/.cache/git",
      {
        mode: config.mode,
      },
    );

    try {
      await provider.fetch();
      const newSha = await provider.getCommitSha();

      spinner.stop(`✓ Pulled latest (${newSha.slice(0, 7)})`);

      // Show what changed
      console.log("\n📝 Git source updated:");
      console.log(`  Repository: ${_url}`);
      console.log(`  Ref: ${gitConfig.ref}`);
      console.log(`  New SHA: ${newSha}`);
      console.log("\n");

      // Add to allow list
      const { parseAllowList, addSourceToAllowList, writeAllowList } =
        await import("@aligntrue/core/team/allow.js");

      const ALLOW_LIST_PATH = ".aligntrue/allow.yaml";
      let allowList = parseAllowList(ALLOW_LIST_PATH);

      // Add git source URL to allow list
      allowList = await addSourceToAllowList(_url, allowList);
      writeAllowList(ALLOW_LIST_PATH, allowList);

      clack.log.success(`Added to allow list: ${_url}`);

      // Prompt to sync
      console.log("\nNext steps:");
      console.log("  aligntrue sync     # Sync with updated source");
      console.log("\n");

      clack.outro("✓ Git source approved and updated");
    } catch (error) {
      spinner.stop("✗ Failed to pull from git source");
      console.error(
        `\n${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("✗ Failed to approve git source");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Approve source(s) for team allow list
 */
async function teamApprove(
  sources: string[],
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  try {
    // Handle git source URLs (e.g., https://github.com/org/rules)
    if (
      sources.length > 0 &&
      (sources[0]?.startsWith("https://") || sources[0]?.startsWith("git@"))
    ) {
      await approveGitSource(sources[0], flags);
      return;
    }

    const current = flags["current"] as boolean | undefined;

    // Handle --current flag
    if (current) {
      const lockfilePath = ".aligntrue.lock.json";
      if (!existsSync(lockfilePath)) {
        console.error("✗ Lockfile not found: .aligntrue.lock.json");
        console.error("  Run: aligntrue sync");
        console.error("  This generates the lockfile with bundle hash");
        process.exit(1);
      }

      try {
        const lockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
        if (!lockfile.bundle_hash) {
          console.error("✗ Lockfile missing bundle_hash");
          process.exit(1);
        }

        const bundleHash = `sha256:${lockfile.bundle_hash}`;
        sources = [bundleHash];

        clack.log.info(
          `Approving current bundle: ${bundleHash.slice(0, 19)}...`,
        );
      } catch (err) {
        console.error("✗ Failed to read lockfile");
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    }

    // Check if at least one source provided (after --current handling)
    if (sources.length === 0) {
      console.error("✗ No sources provided");
      console.error("  Usage: aligntrue team approve <source> [<source2> ...]");
      console.error("  Or: aligntrue team approve --current");
      console.error(
        "  Example: aligntrue team approve https://github.com/yourorg/rules",
      );
      process.exit(1);
    }

    // Load existing allow list
    let allowList = parseAllowList(ALLOW_LIST_PATH);

    clack.intro("Approve Rule Sources");

    // Show diff preview if requested or in interactive mode
    const showPreview = flags["preview"] as boolean | undefined;
    const noPreview = flags["no-preview"] as boolean | undefined;
    const isInteractive = process.stdout.isTTY && !noPreview;

    if ((showPreview || isInteractive) && current) {
      try {
        const { compareBundles } = await import("@aligntrue/core/team");
        const cwd = process.cwd();

        clack.log.info("Loading bundle diff...");

        // Compare with empty previous (MVP - no bundle history yet)
        const diff = await compareBundles("", sources[0] || "", cwd);

        if (
          diff.added.length > 0 ||
          diff.modified.length > 0 ||
          diff.removed.length > 0
        ) {
          console.log("\nChanges in this bundle:\n");

          if (diff.added.length > 0) {
            clack.log.success(`Added ${diff.added.length} section(s):`);
            diff.added.forEach(
              (section: { heading: string; lines: number }) => {
                clack.log.message(
                  `  + ${section.heading} (${section.lines} lines)`,
                );
              },
            );
            console.log("");
          }

          if (diff.modified.length > 0) {
            clack.log.warn(`Modified ${diff.modified.length} section(s):`);
            diff.modified.forEach(
              (section: {
                heading: string;
                linesAdded: number;
                linesRemoved: number;
              }) => {
                const changes = [];
                if (section.linesAdded > 0)
                  changes.push(`+${section.linesAdded}`);
                if (section.linesRemoved > 0)
                  changes.push(`-${section.linesRemoved}`);
                clack.log.message(
                  `  ~ ${section.heading} (${changes.join(", ")} lines)`,
                );
              },
            );
            console.log("");
          }

          if (diff.removed.length > 0) {
            clack.log.error(`Removed ${diff.removed.length} section(s):`);
            diff.removed.forEach(
              (section: { heading: string; lines: number }) => {
                clack.log.message(
                  `  - ${section.heading} (${section.lines} lines)`,
                );
              },
            );
            console.log("");
          }

          // Prompt for confirmation in interactive mode
          if (isInteractive) {
            const shouldProceed = await clack.confirm({
              message: "Approve these changes?",
              initialValue: false,
            });

            if (clack.isCancel(shouldProceed) || !shouldProceed) {
              clack.cancel("Approval cancelled");
              process.exit(0);
            }
          }
        } else {
          clack.log.info("No changes detected in bundle");
        }
      } catch (err) {
        clack.log.warn(
          `Could not load diff preview: ${err instanceof Error ? err.message : String(err)}`,
        );
        clack.log.info("Continuing with approval...");
      }
    }

    // Process each source
    for (const source of sources) {
      const spinner = clack.spinner();
      spinner.start(`Resolving ${source}`);

      try {
        allowList = await addSourceToAllowList(source, allowList);
        spinner.stop(`✓ Approved: ${source}`);
      } catch (err) {
        spinner.stop(`✗ Failed: ${source}`);
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);

        // Continue with remaining sources
        if (sources.length > 1) {
          const shouldContinue = await clack.confirm({
            message: "Continue with remaining sources?",
            initialValue: true,
          });
          if (clack.isCancel(shouldContinue) || !shouldContinue) {
            process.exit(1);
          }
        } else {
          process.exit(1);
        }
      }
    }

    // Write updated allow list
    writeAllowList(ALLOW_LIST_PATH, allowList);

    // Record telemetry
    recordEvent({ command_name: "team-approve", align_hashes_used: [] });

    clack.outro(`✓ Allow list updated: ${ALLOW_LIST_PATH}`);

    console.log("\nNext steps:");
    console.log("  - Commit .aligntrue/allow.yaml to version control");
    console.log("  - Team members can now sync with approved sources");
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to approve sources");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * List allowed sources
 */
async function teamListAllowed(): Promise<void> {
  try {
    // Load allow list
    const allowList = parseAllowList(ALLOW_LIST_PATH);

    if (allowList.sources.length === 0) {
      console.log("No approved sources");
      console.log("\nTo approve a source:");
      console.log("  aligntrue team approve <source>");
      console.log("\nExample:");
      console.log("  aligntrue team approve https://github.com/yourorg/rules");
      return;
    }

    console.log("Approved rule sources:");
    console.log("");

    allowList.sources.forEach((source, idx) => {
      const num = `${idx + 1}.`.padEnd(4);

      if (source.type === "id") {
        console.log(`${num}${source.value}`);
        if (source.resolved_hash) {
          console.log(`     → ${source.resolved_hash}`);
        }
      } else {
        console.log(`${num}${source.value}`);
      }

      if (source.comment) {
        console.log(`     # ${source.comment}`);
      }

      if (idx < allowList.sources.length - 1) {
        console.log("");
      }
    });

    console.log("");
    console.log(
      `Total: ${allowList.sources.length} source${allowList.sources.length !== 1 ? "s" : ""}`,
    );

    // Record telemetry
    recordEvent({ command_name: "team-list-allowed", align_hashes_used: [] });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to list allowed sources");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/**
 * Remove source from allow list
 */
async function teamRemove(sources: string[]): Promise<void> {
  try {
    // Check if at least one source provided
    if (sources.length === 0) {
      console.error("✗ No sources provided");
      console.error("  Usage: aligntrue team remove <source> [<source2> ...]");
      console.error("  Example: aligntrue team remove sha256:abc123...");
      process.exit(1);
    }

    // Load existing allow list
    let allowList = parseAllowList(ALLOW_LIST_PATH);

    if (allowList.sources.length === 0) {
      console.log("Allow list is already empty");
      return;
    }

    clack.intro("Remove Rule Sources");

    // Confirm removal for each source
    for (const source of sources) {
      // Check if source exists
      const exists = allowList.sources.some(
        (s) => s.value === source || s.resolved_hash === source,
      );

      if (!exists) {
        console.log(`⊗ Source not found: ${source}`);
        continue;
      }

      // Confirm removal
      const shouldRemove = await clack.confirm({
        message: `Remove ${source}?`,
        initialValue: false, // Default to no for safety
      });

      if (clack.isCancel(shouldRemove)) {
        clack.cancel("Removal cancelled");
        return;
      }

      if (shouldRemove) {
        allowList = removeSourceFromAllowList(source, allowList);
        console.log(`✓ Removed: ${source}`);
      } else {
        console.log(`⊗ Skipped: ${source}`);
      }
    }

    // Write updated allow list
    writeAllowList(ALLOW_LIST_PATH, allowList);

    // Record telemetry
    recordEvent({ command_name: "team-remove", align_hashes_used: [] });

    clack.outro(`✓ Allow list updated: ${ALLOW_LIST_PATH}`);

    if (allowList.sources.length === 0) {
      console.log("\nAllow list is now empty");
      console.log("  Run: aligntrue team list-allowed");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to remove sources");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
