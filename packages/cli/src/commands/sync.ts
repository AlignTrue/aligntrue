/**
 * Sync command - Sync rules to agents
 * Orchestrates loading config, pulling sources, and syncing IR to/from agents
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";
import * as clack from "@clack/prompts";
import {
  BackupManager,
  getAlignTruePaths,
  SyncEngine,
  type AlignTrueConfig,
  saveMinimalConfig,
} from "@aligntrue/core";
import {
  parseAllowList,
  addSourceToAllowList,
  writeAllowList,
} from "@aligntrue/core/team/allow.js";
import { ExporterRegistry } from "@aligntrue/exporters";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { detectNewAgents } from "../utils/detect-agents.js";
import { resolveAndMergeSources } from "../utils/source-resolver.js";
import { UpdatesAvailableError } from "@aligntrue/sources";

// ANSI color codes for diff output
const _colors = {
  cyan: (str: string) => `\x1b[36m${str}\x1b[0m`,
  green: (str: string) => `\x1b[32m${str}\x1b[0m`,
  yellow: (str: string) => `\x1b[33m${str}\x1b[0m`,
  red: (str: string) => `\x1b[31m${str}\x1b[0m`,
};

// Get the exporters package directory for adapter discovery
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Argument definitions for sync command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
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
 * Sync command implementation
 */
export async function sync(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "sync",
      description:
        "Sync rules from IR to configured agents (default direction)",
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
    return;
  }

  clack.intro("AlignTrue Sync");

  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath =
    (parsed.flags["config"] as string | undefined) || paths.config;

  // Step 1: Check if AlignTrue is initialized
  if (!existsSync(configPath)) {
    exitWithError(Errors.configNotFound(configPath), 2);
  }

  // Step 2: Load config (with standardized error handling)
  const spinner = clack.spinner();
  spinner.start("Loading configuration");

  const config: AlignTrueConfig = await loadConfigWithValidation(configPath);
  spinner.stop("Configuration loaded");

  // Step 2.5: Check allow list in team mode (DEFERRED until after source resolution)
  // We need to compute the NEW bundle hash from current rules before we can validate
  const force = (parsed.flags["force"] as boolean | undefined) || false;
  const forceInvalidIR =
    (parsed.flags["force-invalid-ir"] as boolean | undefined) || false;
  const forceRefresh =
    (parsed.flags["force-refresh"] as boolean | undefined) || false;
  const skipUpdateCheck =
    (parsed.flags["skip-update-check"] as boolean | undefined) || false;
  const offline = (parsed.flags["offline"] as boolean | undefined) || false;
  const verbose = (parsed.flags["verbose"] as boolean | undefined) || false;
  const yes = (parsed.flags["yes"] as boolean | undefined) || false;
  const nonInteractive =
    (parsed.flags["non-interactive"] as boolean | undefined) || false;

  // Step 3: Resolve sources (local, git, or bundle merge)
  spinner.start("Resolving sources");

  let sourcePath: string;
  let absoluteSourcePath: string;
  let bundleResult: Awaited<ReturnType<typeof resolveAndMergeSources>>;

  try {
    bundleResult = await resolveAndMergeSources(config, {
      cwd,
      offlineMode: offline || skipUpdateCheck,
      forceRefresh,
      warnConflicts: true,
    });

    // Use first source path for conflict detection and display
    // (In case of multiple sources, this is the primary/first declared source)
    sourcePath =
      config.sources?.[0]?.type === "local"
        ? config.sources[0].path || paths.rules
        : bundleResult.sources[0]?.sourcePath || ".aligntrue/.rules.yaml";

    absoluteSourcePath =
      config.sources?.[0]?.type === "local"
        ? resolve(cwd, sourcePath)
        : sourcePath;

    spinner.stop(
      bundleResult.sources.length > 1
        ? `Resolved and merged ${bundleResult.sources.length} sources`
        : "Source resolved",
    );

    // Show merge info if multiple sources
    if (bundleResult.sources.length > 1) {
      clack.log.info("Sources merged:");
      bundleResult.sources.forEach((src, idx) => {
        const prefix = idx === 0 ? "  Base:" : "  Overlay:";
        clack.log.info(
          `${prefix} ${src.sourcePath}${src.commitSha ? ` (${src.commitSha.slice(0, 7)})` : ""}`,
        );
      });

      if (bundleResult.conflicts && bundleResult.conflicts.length > 0) {
        clack.log.warn(
          `⚠ ${bundleResult.conflicts.length} merge conflict${bundleResult.conflicts.length !== 1 ? "s" : ""} resolved`,
        );
      }
    }
  } catch (err) {
    spinner.stop("Source resolution failed");

    // Handle git source updates available in team mode
    if (err instanceof UpdatesAvailableError) {
      const updateErr = err as UpdatesAvailableError;
      console.log("\n⚠️  Git source has updates available:\n");
      console.log(`  Repository: ${updateErr.url}`);
      console.log(`  Ref: ${updateErr.ref}`);
      console.log(`  Current SHA: ${updateErr.currentSha.slice(0, 7)}`);
      console.log(`  Latest SHA:  ${updateErr.latestSha.slice(0, 7)}`);
      if (updateErr.commitsBehind > 0) {
        console.log(
          `  Behind by:   ${updateErr.commitsBehind} commit${updateErr.commitsBehind !== 1 ? "s" : ""}`,
        );
      }
      console.log("\n");

      if (config.mode === "team") {
        console.log("Team mode requires approval before updating git sources.");
        console.log("\nOptions:");
        console.log(
          `  1. Approve updates:     aligntrue team approve ${updateErr.url}`,
        );
        console.log(
          `  2. Skip update check:   aligntrue sync --skip-update-check`,
        );
        console.log(`  3. Work offline:        aligntrue sync --offline`);
        console.log("\n");
        process.exit(1);
      }

      // Solo mode should auto-update, so this shouldn't happen
      // If it does, it's a bug
      console.error("Unexpected: UpdatesAvailableError in solo mode");
      process.exit(1);
    }

    // Other errors
    exitWithError(
      {
        ...Errors.fileWriteFailed(
          config.sources?.[0]?.type === "local"
            ? config.sources[0].path || "unknown"
            : config.sources?.[0]?.url || "unknown",
          err instanceof Error ? err.message : String(err),
        ),
        hint: "Check your source configuration in .aligntrue/config.yaml",
      },
      2,
    );
  }

  // Step 3.5: Detect new agents (unless --no-detect or --dry-run)
  const noDetect = (parsed.flags["no-detect"] as boolean | undefined) || false;
  const autoEnable =
    (parsed.flags["auto-enable"] as boolean | undefined) || false;
  const dryRun = (parsed.flags["dry-run"] as boolean | undefined) || false;

  if (!noDetect && !dryRun) {
    const newAgents = detectNewAgents(
      cwd,
      config.exporters || [],
      config.detection?.ignored_agents || [],
    );

    if (newAgents.length > 0) {
      const shouldAutoEnable = autoEnable || config.detection?.auto_enable;

      if (shouldAutoEnable) {
        // Auto-enable without prompting
        clack.log.info(
          `Auto-enabling ${newAgents.length} detected agent(s)...`,
        );
        for (const agent of newAgents) {
          config.exporters!.push(agent.name);
          clack.log.success(`Enabled: ${agent.displayName}`);
        }
        await saveMinimalConfig(config, configPath);
      } else {
        // Prompt for each new agent
        const toEnable: string[] = [];
        const toIgnore: string[] = [];

        for (const agent of newAgents) {
          clack.log.warn(`⚠ New agent detected: ${agent.displayName}`);
          clack.log.info(`  Found: ${agent.filePath}`);

          const response = await clack.select({
            message: `Would you like to enable ${agent.displayName}?`,
            options: [
              {
                value: "yes",
                label: "Yes, enable and export",
                hint: "Add to config and sync rules",
              },
              {
                value: "no",
                label: "No, skip for now",
                hint: "Ask again next time",
              },
              {
                value: "never",
                label: "Never ask about this agent",
                hint: "Add to ignored list",
              },
            ],
          });

          if (clack.isCancel(response)) {
            clack.cancel("Detection cancelled");
            break;
          }

          if (response === "yes") {
            toEnable.push(agent.name);
          } else if (response === "never") {
            toIgnore.push(agent.name);
          }
        }

        // Update config with choices
        if (toEnable.length > 0 || toIgnore.length > 0) {
          if (toEnable.length > 0) {
            config.exporters!.push(...toEnable);
            clack.log.success(
              `Enabled ${toEnable.length} agent(s): ${toEnable.join(", ")}`,
            );
          }

          if (toIgnore.length > 0) {
            if (!config.detection) config.detection = {};
            if (!config.detection.ignored_agents)
              config.detection.ignored_agents = [];
            config.detection.ignored_agents.push(...toIgnore);
            clack.log.info(
              `Ignoring ${toIgnore.length} agent(s): ${toIgnore.join(", ")}`,
            );
          }

          await saveMinimalConfig(config, configPath);
        }
      }
    }
  }

  /**
   * Step 3.75: Lockfile drift detection in team mode
   *
   * Compute NEW bundle hash from current rules and compare to OLD lockfile hash.
   * This detects when rules have changed since last lock.
   *
   * If new hash differs from old AND new hash not in allow list:
   * - Strict mode + non-interactive: Block with exit code 1
   * - Strict mode + interactive: Prompt to approve
   * - Soft mode: Warn and continue
   */
  if (config.mode === "team" && config.modules?.lockfile) {
    const allowListPath = resolve(cwd, ".aligntrue/allow.yaml");
    const lockfilePath = resolve(cwd, ".aligntrue.lock.json");
    const teamOnboardingMarker = join(
      paths.aligntrueDir,
      ".team-onboarding-complete",
    );

    // Compute NEW bundle hash from current rules
    const { generateLockfile, writeLockfile } = await import(
      "@aligntrue/core/lockfile"
    );
    const newLockfile = generateLockfile(
      bundleResult.pack,
      config.mode as "team" | "enterprise",
    );
    const newBundleHash = newLockfile.bundle_hash;
    const newBundleHashWithPrefix = `sha256:${newBundleHash}`;

    // Load OLD lockfile hash (if exists)
    let oldBundleHash: string | undefined;
    if (existsSync(lockfilePath)) {
      try {
        const oldLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
        oldBundleHash = oldLockfile.bundle_hash;
      } catch {
        // Corrupted lockfile - will be regenerated
      }
    }

    // Write new lockfile BEFORE validation so it always reflects current state
    // This ensures drift detection works correctly even if validation fails
    try {
      writeLockfile(lockfilePath, newLockfile, { silent: true });
    } catch (err) {
      clack.log.warn(
        `Failed to write lockfile: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Check if allow list exists
    if (!existsSync(allowListPath)) {
      // Only show full warning if marker doesn't exist (first time)
      if (!existsSync(teamOnboardingMarker)) {
        clack.log.warn("⚠ No allow list found (team mode)");
        clack.log.info("  Allow list will be required for future syncs");
        clack.log.info("  Run: aligntrue team approve --current");
        clack.log.info("  Or: aligntrue team approve <source>");

        // Create marker file to suppress future warnings
        try {
          writeFileSync(teamOnboardingMarker, new Date().toISOString());
        } catch {
          // Silently fail if we can't write marker
        }
      } else {
        // Condensed tip for subsequent syncs
        clack.log.info(
          "💡 Tip: Run 'aligntrue team approve --current' to create allow list",
        );
      }
    } else {
      // Allow list exists - enforce it
      try {
        const allowList = parseAllowList(allowListPath);

        // Check if new bundle hash is approved
        const isApproved = allowList.sources.some(
          (s) =>
            s.value === newBundleHashWithPrefix || s.value === newBundleHash,
        );

        // Detect drift: old hash exists and differs from new hash
        const hasDrift = oldBundleHash && oldBundleHash !== newBundleHash;

        if (hasDrift && oldBundleHash) {
          clack.log.info(
            `ℹ Lockfile drift detected (rules changed since last lock)`,
          );
          clack.log.info(
            `  Old bundle: sha256:${oldBundleHash.slice(0, 16)}...`,
          );
          clack.log.info(
            `  New bundle: sha256:${newBundleHash.slice(0, 16)}...`,
          );
        }

        if (!isApproved && !force) {
          const lockfileMode = config.lockfile?.mode || "soft";

          if (lockfileMode === "soft") {
            // Soft mode: warn but allow to proceed
            clack.log.warn("⚠ Bundle hash not in allow list (soft mode)");
            clack.log.warn(
              `  Current bundle: ${newBundleHashWithPrefix.slice(0, 19)}...`,
            );
            clack.log.info("  Sync will continue. To approve:");
            clack.log.info("    aligntrue team approve --current");
          } else if (lockfileMode === "strict") {
            // Strict mode: check if interactive
            const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

            if (isTTY) {
              // Interactive strict mode: prompt to approve
              clack.log.warn("⚠ Bundle hash not in allow list (strict mode)");
              clack.log.info(
                `  Current bundle: ${newBundleHashWithPrefix.slice(0, 19)}...`,
              );

              const shouldApprove = await clack.confirm({
                message: "Approve this bundle and continue sync?",
                initialValue: false,
              });

              if (clack.isCancel(shouldApprove) || !shouldApprove) {
                console.error("\nSync cancelled. To approve later:");
                console.error("  aligntrue team approve --current");
                process.exit(1);
              }

              // User approved - add to allow list
              try {
                const updatedAllowList = await addSourceToAllowList(
                  newBundleHashWithPrefix,
                  allowList,
                );
                writeAllowList(allowListPath, updatedAllowList);
                clack.log.success("✓ Bundle approved and added to allow list");
                clack.log.info("  Remember to commit .aligntrue/allow.yaml");
              } catch (err) {
                console.error("✗ Failed to update allow list");
                console.error(
                  `  ${err instanceof Error ? err.message : String(err)}`,
                );
                process.exit(1);
              }
            } else {
              // Non-interactive strict mode: show error and exit
              console.error("✗ Bundle hash not in allow list (strict mode)");
              console.error(
                `  Current bundle: ${newBundleHashWithPrefix.slice(0, 19)}...`,
              );
              console.error("\nTo approve this bundle:");
              console.error("  aligntrue team approve --current");
              console.error("\nOr bypass this check (not recommended):");
              console.error("  aligntrue sync --force");
              process.exit(1);
            }
          }
        }

        if (!isApproved && force) {
          clack.log.warn("⚠ Bypassing allow list validation (--force)");
          clack.log.warn("  Bundle hash not approved");
        }
      } catch (err) {
        clack.log.warn(
          `⚠ Failed to validate allow list: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Check for --accept-agent flag
  const acceptAgent = parsed.flags["accept-agent"] as string | undefined;
  if (acceptAgent) {
    clack.log.info(`Manual import from: ${acceptAgent}`);
  }

  // Step 3.5: Check for new agents (with caching)
  if (!dryRun && !acceptAgent) {
    const { loadDetectionCache, saveDetectionCache } = await import(
      "@aligntrue/core"
    );
    const { detectAgentsWithValidation, shouldWarnAboutDetection } =
      await import("../utils/detect-agents.js");

    const detection = detectAgentsWithValidation(cwd, config.exporters || []);
    const cache = loadDetectionCache(cwd);

    if (shouldWarnAboutDetection(detection, cache)) {
      if (detection.missing.length > 0) {
        clack.log.warn(`New agents detected: ${detection.missing.join(", ")}`);

        if (!yes && !nonInteractive) {
          const shouldAdd = await clack.confirm({
            message: "Add detected agents to exporters?",
            initialValue: true,
          });

          if (!clack.isCancel(shouldAdd) && shouldAdd) {
            config.exporters = [
              ...(config.exporters || []),
              ...detection.missing,
            ];
            await saveMinimalConfig(config, configPath, cwd);
            clack.log.success("Updated exporters in config");
          }
        }
      }

      if (detection.notFound.length > 0) {
        clack.log.info(
          `Configured exporters not detected: ${detection.notFound.join(", ")}\n` +
            "  (These agents may not be installed)",
        );
      }

      // Update cache
      saveDetectionCache(cwd, {
        timestamp: new Date().toISOString(),
        detected: detection.detected,
        configured: config.exporters || [],
      });
    }
  }

  // Step 4: Discover and load exporters
  spinner.start("Loading exporters");

  const engine = new SyncEngine();
  const registry = new ExporterRegistry();

  try {
    // Discover adapters from exporters package
    // Use import.meta.resolve to find the installed package location
    let exportersDistPath: string;
    try {
      // Try to resolve the exporters package using Node's module resolution
      const exportersPackagePath = await import.meta.resolve(
        "@aligntrue/exporters",
      );
      // Convert file:// URL to path and get the package directory
      const exportersIndexPath = fileURLToPath(exportersPackagePath);
      // The resolved path points to dist/index.js, we want the dist directory
      exportersDistPath = dirname(exportersIndexPath);
    } catch {
      // Fallback to relative path for development (workspace)
      exportersDistPath = resolve(__dirname, "../../../exporters/dist");
    }
    const manifestPaths = registry.discoverAdapters(exportersDistPath);

    // Load manifests and handlers for configured exporters
    const exporterNames = config.exporters || ["cursor", "agents-md"];
    let loadedCount = 0;

    for (const exporterName of exporterNames) {
      // Find manifest for this exporter
      const manifestPath = manifestPaths.find((path) => {
        const manifest = registry.loadManifest(path);
        return manifest.name === exporterName;
      });

      if (manifestPath) {
        await registry.registerFromManifest(manifestPath);
        const exporter = registry.get(exporterName);
        if (exporter) {
          engine.registerExporter(exporter);
          loadedCount++;
        }
      } else {
        clack.log.warn(`Exporter not found: ${exporterName}`);
      }
    }

    spinner.stop(
      `Loaded ${loadedCount} exporter${loadedCount !== 1 ? "s" : ""}`,
    );

    if (loadedCount > 0) {
      const names = exporterNames.slice(0, loadedCount).join(", ");
      clack.log.success(`Active: ${names}`);
    }
  } catch (_error) {
    spinner.stop("Exporter loading failed");
    exitWithError(
      Errors.syncFailed(
        `Failed to load exporters: ${_error instanceof Error ? _error.message : String(_error)}`,
      ),
    );
  }

  // Step 5.5: Validate rule IDs in resolved bundle
  spinner.start("Validating rules");

  try {
    // Collect all invalid rule IDs from the merged bundle
    const invalidRules: Array<{
      index: number;
      id: string;
      error: string;
      suggestion?: string;
    }> = [];

    // Section IDs are validated at parse time by the markdown parser
    // No additional validation needed in the sync command
    const sections = bundleResult.pack.sections || [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;

      // Section validation happens at parse time
      // Skip individual validation in sections format
    }

    if (invalidRules.length > 0) {
      spinner.stop("Validation failed");

      console.log("");
      clack.log.error("Validation failed");
      console.log("");
      clack.log.error(`Invalid rule IDs in bundle:`);
      console.log("");

      invalidRules.forEach(({ index, id, error, suggestion }) => {
        clack.log.error(`  Rule ${index}: "${id}"`);
        clack.log.error(`    ✗ ${error}`);
        if (suggestion) {
          clack.log.info(`    ✓ ${suggestion}`);
        }
        console.log("");
      });

      console.log("Format: category.subcategory.rule-name");
      console.log("Examples: testing.require.tests, security.no.secrets");
      console.log("");
      console.log("Fix the IDs above and run: aligntrue sync");
      console.log("");

      process.exit(1);
    }

    spinner.stop("Rules validated");
  } catch (_error) {
    spinner.stop("Validation failed");
    exitWithError(
      Errors.syncFailed(
        `Failed to validate rules: ${_error instanceof Error ? _error.message : String(_error)}`,
      ),
    );
  }

  // Step 5.75: Write merged bundle to local IR (if sources resolved successfully)
  // This updates the local .rules.yaml with the merged bundle before syncing to agents
  if (bundleResult.sources.length > 0) {
    try {
      const yaml = await import("yaml");
      const bundleYaml = yaml.stringify(bundleResult.pack);

      // For local sources, write to the specified path
      // For git/remote sources, write to default .aligntrue/.rules.yaml
      const targetPath =
        config.sources?.[0]?.type === "local"
          ? resolve(cwd, config.sources[0].path || paths.rules)
          : resolve(cwd, paths.rules);

      writeFileSync(targetPath, bundleYaml, "utf-8");

      // Update absoluteSourcePath to point to the local file we just wrote
      // This ensures SyncEngine reads from the correct local path
      absoluteSourcePath = targetPath;
    } catch (err) {
      exitWithError(
        Errors.fileWriteFailed(
          "merged bundle",
          err instanceof Error ? err.message : String(err),
        ),
        2,
      );
    }
  }

  // Step 6: Auto-backup (if configured and not dry-run)
  if (!dryRun && config.backup?.auto_backup) {
    const backupOn = config.backup.backup_on || ["sync"];
    if (backupOn.includes("sync")) {
      spinner.start("Creating backup");
      try {
        const backup = BackupManager.createBackup({
          cwd,
          created_by: "sync",
          notes: "Auto-backup before sync",
        });
        spinner.stop(`Backup created: ${backup.timestamp}`);
        clack.log.info(
          `Restore with: aligntrue backup restore --to ${backup.timestamp}`,
        );
      } catch (_error) {
        spinner.stop("Backup failed");
        clack.log.warn(
          `Failed to create backup: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
        clack.log.warn("Continuing with sync...");
      }
    }
  }

  // Step 6.5: Two-way sync - detect and merge agent file edits
  if (!acceptAgent && config.sync?.two_way !== false) {
    try {
      // Get last sync timestamp for accurate change detection
      const { getLastSyncTimestamp } = await import(
        "@aligntrue/core/sync/last-sync-tracker"
      );
      const lastSyncTime = getLastSyncTimestamp(cwd);
      const lastSyncDate = lastSyncTime ? new Date(lastSyncTime) : undefined;

      // Log detection attempt in verbose mode
      if (verbose) {
        clack.log.info(
          `Checking for edits since: ${lastSyncDate?.toISOString() || "never"}`,
        );
      }

      // Dynamic import at runtime
      const multiFileParser = "@aligntrue/core/sync/multi-file-parser";
      // @ts-ignore - Dynamic import resolved at runtime
      const { detectEditedFiles } = await import(multiFileParser);

      // Detect edited agent files with lastSyncDate
      const detectionResult = await detectEditedFiles(
        cwd,
        config,
        lastSyncDate,
      );
      const editedFiles = detectionResult.files || [];
      const editSourceWarnings = detectionResult.warnings || [];

      // Display edit_source warnings if any
      if (editSourceWarnings.length > 0) {
        for (const warning of editSourceWarnings) {
          clack.log.warn(
            `⚠ ${warning.filePath} was edited but is not in edit_source`,
          );
          clack.log.info(`  ${warning.reason}`);
          clack.log.info(`  To enable editing: ${warning.suggestedFix}`);
        }
      }

      if (editedFiles.length > 0) {
        // Phase 1: Agent edits → IR
        if (verbose) {
          clack.log.info("Phase 1: Merging agent file edits into IR");
        }

        spinner.start("Merging changes from edited files");

        clack.log.info(
          `Detected ${editedFiles.length} edited file${editedFiles.length !== 1 ? "s" : ""}:`,
        );
        editedFiles.forEach((f: { path: string; sections: unknown[] }) => {
          clack.log.info(`  - ${f.path}: ${f.sections.length} section(s)`);
        });

        // Run two-way sync via engine
        const twoWayResult = await engine.syncFromMultipleAgents(configPath, {
          dryRun,
          force,
        });

        spinner.stop("Changes merged");

        if (twoWayResult.warnings && twoWayResult.warnings.length > 0) {
          twoWayResult.warnings.forEach((warning) => {
            clack.log.warn(`⚠ ${warning}`);
          });
        }

        clack.log.success("Merged changes from agent files to IR");
      } else {
        // No edits detected - this is normal when IR is the source of truth
        if (verbose) {
          clack.log.info(
            "Phase 1: No agent file edits detected since last sync",
          );
          clack.log.info("  → IR is already up to date");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if this is an IR validation error
      const isValidationError = errorMessage.includes("Invalid IR");

      if (isValidationError && !forceInvalidIR) {
        // Validation errors should fail the sync unless --force-invalid-ir is used
        clack.log.error(`✗ IR validation failed`);
        clack.log.error(`\n${errorMessage}\n`);
        clack.log.info(
          "To bypass validation (not recommended), use: aligntrue sync --force-invalid-ir",
        );
        process.exit(1);
      }

      // For other errors or when forced, warn and continue
      if (forceInvalidIR && isValidationError) {
        clack.log.warn(
          `⚠ IR validation failed but continuing due to --force-invalid-ir flag`,
        );
        clack.log.warn(`  ${errorMessage}`);
      } else {
        clack.log.warn(`⚠ Two-way sync failed: ${errorMessage}`);
      }
      clack.log.info("Continuing with one-way sync...");
    }
  }

  // Step 7: Execute sync (with auto-pull if enabled)
  try {
    const syncOptions: {
      configPath: string;
      dryRun: boolean;
      force: boolean;
      interactive: boolean;
      acceptAgent?: string;
      defaultResolutionStrategy?: string;
    } = {
      configPath,
      dryRun: dryRun,
      force: force,
      interactive: !force && !yes && !nonInteractive,
    };

    // Only set defaultResolutionStrategy if we have a value
    if (force || yes || nonInteractive) {
      syncOptions.defaultResolutionStrategy = "accept_agent";
    }

    if (acceptAgent !== undefined) {
      syncOptions.acceptAgent = acceptAgent;
    }

    let result;

    // Execute sync operation
    if (acceptAgent) {
      // Manual agent → IR sync (pullback)
      spinner.start(
        dryRun ? "Previewing import" : `Importing from ${acceptAgent}`,
      );
      result = await engine.syncFromAgent(
        acceptAgent,
        absoluteSourcePath,
        syncOptions,
      );
    } else {
      // IR → agents sync (default)
      // Phase 2: Export IR to all configured agents
      if (verbose) {
        clack.log.info("Phase 2: Exporting IR to all configured agents");
      }

      spinner.start(dryRun ? "Previewing changes" : "Syncing to agents");
      result = await engine.syncToAgents(absoluteSourcePath, syncOptions);
    }

    // Stop spinner
    spinner.stop(dryRun ? "Preview complete" : "Sync complete");

    // Step 8: Remove starter file after first successful sync (if applicable)
    if (!dryRun && result.success && !acceptAgent) {
      const starterPath = join(cwd, ".cursor/rules/aligntrue-starter.mdc");
      const syncedPath = join(cwd, ".cursor/rules/aligntrue.mdc");
      if (existsSync(starterPath) && existsSync(syncedPath)) {
        try {
          unlinkSync(starterPath);
          clack.log.info("Removed starter file (replaced by synced rules)");
        } catch {
          // Silent failure - not critical
        }
      }
    }

    // Step 9: Auto-cleanup old backups (if configured and not dry-run)
    if (!dryRun && config.backup?.auto_backup) {
      // keep_count always has default from config loader
      const keepCount = config.backup.keep_count!;
      try {
        const removed = BackupManager.cleanupOldBackups({ cwd, keepCount });
        if (removed > 0) {
          clack.log.info(
            `Cleaned up ${removed} old backup${removed !== 1 ? "s" : ""}`,
          );
        }
      } catch {
        // Silent failure on cleanup - not critical
      }
    }

    // Step 9.5: Update .gitignore if configured
    if (
      !dryRun &&
      result.success &&
      result.written &&
      result.written.length > 0
    ) {
      const gitMode = config.git?.mode || "ignore";
      const autoGitignore = config.git?.auto_gitignore || "auto";

      if (autoGitignore !== "never") {
        try {
          const { GitIntegration } = await import("@aligntrue/core");
          const gitIntegration = new GitIntegration();
          await gitIntegration.updateGitignore(
            cwd,
            result.written,
            autoGitignore,
            gitMode,
          );
        } catch (_error) {
          // Silent failure on gitignore update - not critical
          if (verbose) {
            clack.log.warn(
              `Failed to update .gitignore: ${_error instanceof Error ? _error.message : String(_error)}`,
            );
          }
        }
      }
    }

    // Step 10: Display results
    if (result.success) {
      if (dryRun) {
        clack.log.info("Dry-run mode: no files written");
      }

      // Show written files
      if (result.written && result.written.length > 0) {
        // Deduplicate file paths (multiple exporters may write to same file)
        const uniqueFiles = Array.from(new Set(result.written));
        clack.log.success(
          `${dryRun ? "Would write" : "Wrote"} ${uniqueFiles.length} file${uniqueFiles.length !== 1 ? "s" : ""}`,
        );
        uniqueFiles.forEach((file) => {
          clack.log.info(`  ${file}`);
        });
      }

      // Show warnings
      if (result.warnings && result.warnings.length > 0) {
        if (verbose) {
          // Show all warnings in verbose mode
          result.warnings.forEach((warning) => {
            clack.log.warn(warning);
          });
        } else {
          // Show summary count for fidelity notes, full text for other warnings
          const fidelityNotes = result.warnings.filter(
            (w) => w.startsWith("[") && w.length > 3,
          );
          const otherWarnings = result.warnings.filter(
            (w) => !w.startsWith("[") || w.length <= 3,
          );

          if (fidelityNotes.length > 0) {
            clack.log.info(
              `ℹ ${fidelityNotes.length} fidelity note${fidelityNotes.length !== 1 ? "s" : ""} (use --verbose to see details)`,
            );
          }

          // Always show non-fidelity warnings
          otherWarnings.forEach((warning) => {
            clack.log.warn(warning);
          });
        }
      }

      // Conflict display removed - not needed for sections-only format

      // Show audit trail in dry-run
      if (dryRun && result.auditTrail && result.auditTrail.length > 0) {
        clack.log.info("\nAudit trail:");
        result.auditTrail.forEach((entry) => {
          clack.log.info(
            `  [${entry.action}] ${entry.target}: ${entry.details}`,
          );
        });
      }

      // Show provenance in dry-run
      if (dryRun && result.auditTrail) {
        const provenanceEntries = result.auditTrail.filter(
          (e) =>
            e.provenance &&
            (e.provenance.owner ||
              e.provenance.source ||
              e.provenance.source_sha),
        );

        if (provenanceEntries.length > 0) {
          clack.log.info("\nProvenance:");
          provenanceEntries.forEach((entry) => {
            const p = entry.provenance!;
            const parts: string[] = [];
            if (p.owner) parts.push(`owner=${p.owner}`);
            if (p.source) parts.push(`source=${p.source}`);
            if (p.source_sha) parts.push(`sha=${p.source_sha.slice(0, 7)}`);

            if (parts.length > 0) {
              clack.log.message(`  ${entry.target}: ${parts.join(", ")}`);
            }
          });
        }
      }

      // Record telemetry event on success
      try {
        const loadedAdapters = registry
          .list()
          .map((name) => registry.get(name)!)
          .filter(Boolean);
        const exportTargets = loadedAdapters.map((a) => a.name).join(",");

        recordEvent({
          command_name: "sync",
          export_target: exportTargets,
          align_hashes_used: [], // Rule hashes would require loading the IR file again
        });
      } catch {
        // Telemetry errors should not fail the sync command
        // Silently continue
      }

      // Show conflict summary if any
      if (result.conflicts && result.conflicts.length > 0) {
        const showConflicts =
          (parsed.flags["show-conflicts"] as boolean | undefined) || false;

        console.log("\n");
        clack.log.warn("⚠️  CONFLICTS DETECTED\n");

        for (const conflict of result.conflicts) {
          clack.log.warn(
            `Section "${conflict.heading}" edited in multiple files:`,
          );

          // Sort files by mtime to show chronologically
          const sortedFiles = [...conflict.files].sort(
            (a, b) => a.mtime.getTime() - b.mtime.getTime(),
          );

          for (const file of sortedFiles) {
            const timeStr = file.mtime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
            const isWinner = file.path === conflict.winner;
            const marker = isWinner ? "✓" : " ";
            clack.log.message(`  ${marker} ${file.path} (modified ${timeStr})`);
          }

          clack.log.message(`  → Using: ${conflict.winner} (most recent)\n`);

          // Show detailed content if --show-conflicts flag is present
          if (showConflicts) {
            // Read the winning file to show its content
            try {
              const { readFileSync } = await import("fs");
              const { parseAgentsMd, parseCursorMdc } = await import(
                "@aligntrue/schema"
              );

              for (const file of sortedFiles) {
                const content = readFileSync(file.path, "utf-8");
                let sections;

                if (file.path.endsWith(".md")) {
                  sections = parseAgentsMd(content).sections;
                } else if (file.path.endsWith(".mdc")) {
                  sections = parseCursorMdc(content).sections;
                } else {
                  continue;
                }

                const section = sections.find(
                  (s: { heading: string }) =>
                    s.heading.toLowerCase().trim() ===
                    conflict.heading.toLowerCase().trim(),
                );

                if (section) {
                  const isWinner = file.path === conflict.winner;
                  const marker = isWinner ? "[KEPT]" : "[DISCARDED]";
                  clack.log.message(`\n  ${marker} Content from ${file.path}:`);
                  clack.log.message(`  ${"─".repeat(60)}`);
                  const lines = section.content.split("\n");
                  lines.slice(0, 10).forEach((line: string) => {
                    clack.log.message(`  ${line}`);
                  });
                  if (lines.length > 10) {
                    clack.log.message(
                      `  ... (${lines.length - 10} more lines)`,
                    );
                  }
                  clack.log.message(`  ${"─".repeat(60)}`);
                }
              }
            } catch (err) {
              clack.log.warn(
                `  Could not read section content: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }

        if (!showConflicts) {
          clack.log.info(
            `Run 'aligntrue sync --show-conflicts' to see detailed changes\n`,
          );
        }
      }

      // Show success message with next steps
      if (dryRun) {
        clack.outro("✓ Preview complete");
      } else {
        const loadedAdapters = registry
          .list()
          .map((name) => registry.get(name)!)
          .filter(Boolean);
        const exporterNames = loadedAdapters.map((a) => a.name);
        const writtenFiles = result.written || [];
        // Deduplicate file paths (multiple exporters may write to same file)
        const uniqueWrittenFiles = Array.from(new Set(writtenFiles));

        let message = "✓ Sync complete\n\n";

        if (uniqueWrittenFiles.length > 0) {
          message += `Synced to ${exporterNames.length} agent${exporterNames.length !== 1 ? "s" : ""}:\n`;
          uniqueWrittenFiles.forEach((file) => {
            message += `  - ${file}\n`;
          });
          message += "\n";
        }

        message += "Your AI assistants are now aligned with these rules.\n\n";
        message +=
          "Next: Start coding! Your agents will follow the rules automatically.\n\n";
        message +=
          "Tip: Update rules anytime by editing AGENTS.md or any agent file and running: aligntrue sync";

        clack.outro(message);

        // Update last sync timestamp after successful sync
        try {
          const { updateLastSyncTimestamp } = await import(
            "@aligntrue/core/sync/last-sync-tracker"
          );
          updateLastSyncTimestamp(cwd);
        } catch (err) {
          // Log warning but don't fail sync
          if (verbose) {
            clack.log.warn(
              `Failed to update last sync timestamp: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    } else {
      // Sync failed
      clack.log.error("Sync failed");

      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          clack.log.error(`  ${warning}`);
        });
      }

      clack.outro("✗ Sync failed");
      process.exit(1);
    }
  } catch (error) {
    spinner.stop("Sync failed");
    clack.log.error(
      `Sync error: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Show helpful suggestions
    if (error instanceof Error) {
      if (error.message.includes("lockfile")) {
        clack.log.info("Lockfile drift detected. To approve these changes:");
        clack.log.info("  1. Review the changes above");
        clack.log.info("  2. Run: aligntrue team approve --current");
        clack.log.info("  3. Commit .aligntrue/allow.yaml to version control");
        clack.log.info("");
        clack.log.info(
          "Or set lockfile.mode: soft in config for warnings only",
        );
      } else if (error.message.includes("exporter")) {
        clack.log.info(
          "Check exporter configuration in .aligntrue/config.yaml",
        );
      }
    }

    clack.outro("✗ Sync failed");
    process.exit(1);
  }
}
