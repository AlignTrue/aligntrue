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
  loadIR,
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
import { WorkflowDetector } from "../utils/workflow-detector.js";
import { detectNewAgents } from "../utils/detect-agents.js";
import { resolveAndMergeSources } from "../utils/source-resolver.js";

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

  // Step 3: Resolve sources (local, git, or bundle merge)
  spinner.start("Resolving sources");

  let sourcePath: string;
  let absoluteSourcePath: string;
  let bundleResult: Awaited<ReturnType<typeof resolveAndMergeSources>>;

  try {
    bundleResult = await resolveAndMergeSources(config, {
      cwd,
      offlineMode: false,
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
    const { generateLockfile } = await import("@aligntrue/core/lockfile");
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

  /**
   * Step 3.9: Agent file drift warning in team mode
   *
   * In team mode with auto_pull disabled (default), warn if agent files
   * have been modified after IR. This guides developers to use the correct
   * workflow: edit IR, not agent files.
   */
  if (config.mode === "team" && !config.sync?.auto_pull) {
    // TODO: Implement edit detection for sections-only format
    // EditDetector is not yet implemented for sections format
    const agentFiles = [
      { path: "AGENTS.md", agent: "agents-md" },
      { path: ".cursor/rules/aligntrue.mdc", agent: "cursor" },
    ];

    for (const { path: agentPath, agent } of agentFiles) {
      const fullAgentPath = resolve(cwd, agentPath);

      // Skip if agent file doesn't exist
      if (!existsSync(fullAgentPath)) {
        continue;
      }

      // TODO: Check if agent file is newer than IR in sections format
      // Edit detection not yet implemented for sections-only format
      const conflictInfo = { agentModified: false, irModified: false };

      // If agent file was modified (but not IR), warn
      if (conflictInfo.agentModified && !conflictInfo.irModified) {
        clack.log.warn(`⚠ ${agentPath} modified after IR`);
        clack.log.info("  In team mode, edit .aligntrue/.rules.yaml instead");
        clack.log.info(`  Or run: aligntrue sync --accept-agent ${agent}`);
      }
    }
  }

  /**
   * Step 4: Auto-pull logic with conflict detection
   *
   * If enabled, pulls from primary_agent BEFORE syncing IR to agents.
   * This keeps IR in sync with any edits made directly to agent config files.
   *
   * Conditions for auto-pull:
   * 1. config.sync.auto_pull is true (default in solo mode)
   * 2. User didn't manually specify --accept-agent (manual import takes precedence)
   * 3. primary_agent is configured (auto-detected on init)
   * 4. primary_agent's file exists and is importable
   * 5. No conflict detected (both IR and agent modified since last sync)
   *
   * Mode defaults:
   * - Solo: auto_pull ON (enables native-format editing workflow)
   * - Team: auto_pull OFF (IR is single source of truth)
   *
   * See: packages/core/src/config/index.ts (lines 253-303) for mode defaults
   */
  let shouldAutoPull = false;
  let autoPullAgent: string | undefined;
  const acceptAgent = parsed.flags["accept-agent"] as string | undefined;
  const noAutoPull =
    (parsed.flags["no-auto-pull"] as boolean | undefined) || false;
  const _showAutoPullDiff =
    (parsed.flags["show-auto-pull-diff"] as boolean | undefined) || false;

  if (config.sync?.auto_pull && !acceptAgent && !noAutoPull) {
    // Auto-pull enabled and user didn't manually specify agent
    autoPullAgent = config.sync.primary_agent;

    if (autoPullAgent) {
      // Auto-pull disabled - import functionality removed
      // Users should edit AGENTS.md directly
      shouldAutoPull = false;
      if (false) {
        const agentSourcePath = "";

        if (existsSync(agentSourcePath)) {
          // TODO: Check for conflicts before auto-pull in sections format
          // Conflict detection not yet implemented for sections-only format
          const conflictInfo = { hasConflict: false };

          if (conflictInfo.hasConflict) {
            // Both files modified - show conflict warning
            clack.log.warn("⚠ Conflict detected:");
            clack.log.warn(`  - You edited ${sourcePath}`);
            clack.log.warn(`  - Changes also found in ${agentSourcePath}`);
            clack.log.warn("");

            // Check if workflow has been configured
            const workflowDetector = new WorkflowDetector(cwd);
            const workflowConfigured = workflowDetector.isWorkflowConfigured();

            // On first conflict, offer workflow choice
            if (!workflowConfigured && config.sync?.workflow_mode === "auto") {
              clack.log.info(
                "💡 This is your first conflict. Let's configure your workflow.",
              );
              clack.log.info("");

              const workflowChoice =
                await workflowDetector.promptWorkflowChoice();

              if (!clack.isCancel(workflowChoice)) {
                await workflowDetector.saveWorkflowChoice(
                  workflowChoice,
                  config,
                  configPath,
                );

                // Update config in memory for this sync
                if (!config.sync) config.sync = {};
                config.sync!.workflow_mode = workflowChoice;

                clack.log.info("");
              }
            }

            // Resolve conflict based on workflow mode
            const workflowMode = config.sync?.workflow_mode || "auto";

            if (workflowMode === "ir_source") {
              // IR-source workflow: always keep IR edits
              clack.log.info("Workflow: IR-source (keeping your edits)");
              shouldAutoPull = false;
            } else if (workflowMode === "native_format") {
              // Native-format workflow: always accept agent
              clack.log.info(
                `Workflow: Native-format (accepting ${autoPullAgent} changes)`,
              );
              shouldAutoPull = true;
            } else {
              // Auto mode: prompt user for resolution
              const resolution = await clack.select({
                message: "How would you like to resolve this conflict?",
                options: [
                  {
                    value: "keep-ir",
                    label: "Keep my edits to AGENTS.md (skip auto-pull)",
                    hint: "Recommended if you manually edited AGENTS.md",
                  },
                  {
                    value: "accept-agent",
                    label: `Accept changes from ${autoPullAgent}`,
                    hint: "Overwrites your AGENTS.md edits",
                  },
                  {
                    value: "abort",
                    label: "Abort sync and review manually",
                    hint: "Exit without making any changes",
                  },
                ],
              });

              if (resolution === "abort" || clack.isCancel(resolution)) {
                clack.outro("Sync aborted. Review conflicts manually.");
                return;
              }

              if (resolution === "keep-ir") {
                clack.log.info("Skipping auto-pull, keeping your edits");
                shouldAutoPull = false;
              } else {
                clack.log.info(`Accepting changes from ${autoPullAgent}`);
                shouldAutoPull = true;
              }
            }
          } else {
            shouldAutoPull = true;
            clack.log.info(`Auto-pull enabled: pulling from ${autoPullAgent}`);
          }
        }
      }
    }
  }

  // Step 5: Check for --accept-agent flag
  if (acceptAgent) {
    clack.log.info(`Manual import from: ${acceptAgent}`);
  }

  // Step 5: Discover and load exporters
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

    // TODO: Validate section IDs in sections-only format
    // Section IDs are validated at parse time, no additional validation needed here
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

  // Step 7: Execute sync (with auto-pull if enabled)
  try {
    const yes = (parsed.flags["yes"] as boolean | undefined) || false;
    const nonInteractive =
      (parsed.flags["non-interactive"] as boolean | undefined) || false;

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

    // First: Auto-pull from primary agent (if enabled)
    if (shouldAutoPull && autoPullAgent) {
      spinner.start(`Auto-pulling from ${autoPullAgent}`);

      // Snapshot current rules for diff calculation
      // TODO: Track sections changes for auto-pull in sections-only format
      // For now, skip tracking since import is not yet implemented
      try {
        const _currentIR = await loadIR(absoluteSourcePath);
        // Track sections instead of rules for future diffing
      } catch {
        // Ignore errors - might be first sync
      }

      // Auto-pull disabled - import functionality removed
      // Users should edit AGENTS.md directly
    }

    // Then: Execute requested sync operation
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
      const keepCount = config.backup.keep_count ?? 10;
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

    // Step 10: Display results
    if (result.success) {
      if (dryRun) {
        clack.log.info("Dry-run mode: no files written");
      }

      // Show written files
      if (result.written && result.written.length > 0) {
        clack.log.success(
          `${dryRun ? "Would write" : "Wrote"} ${result.written.length} file${result.written.length !== 1 ? "s" : ""}`,
        );
        result.written.forEach((file) => {
          clack.log.info(`  ${file}`);
        });
      }

      // Show warnings
      if (result.warnings && result.warnings.length > 0) {
        const verbose = parsed.flags["verbose"] as boolean | undefined;
        if (verbose) {
          // Show all warnings in verbose mode
          result.warnings.forEach((warning) => {
            clack.log.warn(warning);
          });
        } else {
          // Show summary count for fidelity notes, full text for other warnings
          const fidelityNotes = result.warnings.filter((w) =>
            w.startsWith("["),
          );
          const otherWarnings = result.warnings.filter(
            (w) => !w.startsWith("["),
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

      // TODO: Update last sync timestamp for conflict detection in sections format
      // Timestamp tracking not yet implemented for sections-only format
      if (!dryRun) {
        // Conflict detection skipped for now
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

        let message = "✓ Sync complete\n\n";

        if (writtenFiles.length > 0) {
          message += `Synced to ${exporterNames.length} agent${exporterNames.length !== 1 ? "s" : ""}:\n`;
          writtenFiles.forEach((file) => {
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
