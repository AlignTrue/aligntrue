/**
 * Sync command - Sync rules to agents
 * Orchestrates loading config, pulling sources, and syncing IR to/from agents
 */

import { existsSync, writeFileSync, unlinkSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";
import * as clack from "@clack/prompts";
import {
  BackupManager,
  getAlignTruePaths,
  SyncEngine,
  type AlignTrueConfig,
  loadIR,
  canImportFromAgent,
  getImportSourcePath,
  importFromAgent,
  saveMinimalConfig,
} from "@aligntrue/core";
import { parseAllowList } from "@aligntrue/core/team/allow.js";
import { ExporterRegistry } from "@aligntrue/exporters";
import {
  validateRuleId,
  validateAlignSchema,
  AlignRule,
} from "@aligntrue/schema";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import {
  EditDetector,
  calculateRuleDiff,
  formatDiffSummary,
  formatFullDiff,
} from "@aligntrue/core/sync";
import { WorkflowDetector } from "../utils/workflow-detector.js";
import { detectNewAgents } from "../utils/detect-agents.js";

// ANSI color codes for diff output
const colors = {
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
        "  Loads rules from .aligntrue/.rules.yaml (internal IR), resolves scopes,",
        "  and syncs to configured agent exporters (Cursor, AGENTS.md, VS Code MCP, etc.).",
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

  // Step 2.5: Check allow list in team mode
  const force = (parsed.flags["force"] as boolean | undefined) || false;

  if (config.mode === "team") {
    const allowListPath = resolve(cwd, ".aligntrue/allow.yaml");
    const teamOnboardingMarker = join(
      paths.aligntrueDir,
      ".team-onboarding-complete",
    );

    // Check if allow list exists first
    if (!existsSync(allowListPath)) {
      // Only show full warning if marker doesn't exist
      if (!existsSync(teamOnboardingMarker)) {
        clack.log.info("ℹ No allow list found (team mode)");
        clack.log.info(
          "  Sources will be validated once allow list is created",
        );
        clack.log.info("  Run: aligntrue team approve <source>");

        // Create marker file to suppress future warnings
        try {
          writeFileSync(teamOnboardingMarker, new Date().toISOString());
        } catch {
          // Silently fail if we can't write marker
        }
      } else {
        // Show condensed tip
        clack.log.info(
          "💡 Tip: Run 'aligntrue team approve <source>' to create allow list",
        );
      }
    } else {
      try {
        const _allowList = parseAllowList(allowListPath);

        // Validate each source in config
        const unapprovedSources: string[] = [];

        if (config.sources) {
          for (const source of config.sources) {
            // For now, just check path-based sources
            // TODO Phase 3.5: Check git sources once implemented
            if (source.path && source.path !== paths.rules) {
              // External source path - would need approval if pulling from git
              // For local paths, skip validation
              continue;
            }
          }
        }

        if (unapprovedSources.length > 0 && !force) {
          console.error("✗ Unapproved sources in team mode:");
          unapprovedSources.forEach((src) => console.error(`  - ${src}`));
          console.error("\nTo approve sources:");
          console.error("  aligntrue team approve <source>");
          console.error("\nOr bypass this check (not recommended):");
          console.error("  aligntrue sync --force");
          process.exit(1);
        }

        if (unapprovedSources.length > 0 && force) {
          clack.log.warn("⚠ Bypassing allow list validation (--force)");
          clack.log.warn(
            `  ${unapprovedSources.length} unapproved source${unapprovedSources.length !== 1 ? "s" : ""}`,
          );
        }
      } catch (_err) {
        // Parsing error - log but don't fail
        clack.log.warn(
          `⚠ Failed to validate allow list: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }
    }
  }

  // Step 3: Validate source path
  const sourcePath = config.sources?.[0]?.path || paths.rules;
  const absoluteSourcePath = resolve(cwd, sourcePath);

  if (!existsSync(absoluteSourcePath)) {
    exitWithError(
      {
        ...Errors.rulesNotFound(sourcePath),
        details: [`Expected path: ${absoluteSourcePath}`],
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
  const showAutoPullDiff =
    (parsed.flags["show-auto-pull-diff"] as boolean | undefined) || false;

  if (config.sync?.auto_pull && !acceptAgent && !noAutoPull) {
    // Auto-pull enabled and user didn't manually specify agent
    autoPullAgent = config.sync.primary_agent;

    if (autoPullAgent) {
      // Check if primary agent's file exists
      if (canImportFromAgent(autoPullAgent)) {
        const agentSourcePath = getImportSourcePath(autoPullAgent, cwd);

        if (existsSync(agentSourcePath)) {
          // Check for conflicts before auto-pull
          const detector = new EditDetector(cwd);
          const conflictInfo = detector.hasConflict(
            absoluteSourcePath,
            agentSourcePath,
          );

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
            if (!workflowConfigured && config.sync.workflow_mode === "auto") {
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
                config.sync.workflow_mode = workflowChoice;

                clack.log.info("");
              }
            }

            // Resolve conflict based on workflow mode
            const workflowMode = config.sync.workflow_mode || "auto";

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
    // Look for manifests in the exporters src directory
    const exportersSrcPath = resolve(__dirname, "../../../exporters/src");
    const manifestPaths = registry.discoverAdapters(exportersSrcPath);

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

  // Step 5.5: Load and validate rule IDs in IR
  spinner.start("Validating rules");

  try {
    const ir = await loadIR(absoluteSourcePath);

    // Collect all invalid rule IDs
    const invalidRules: Array<{
      index: number;
      id: string;
      error: string;
      suggestion?: string;
    }> = [];

    const rules = ir.rules || [];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule) continue;

      const validation = validateRuleId(rule.id);
      if (!validation.valid) {
        const invalidRule: {
          index: number;
          id: string;
          error: string;
          suggestion?: string;
        } = {
          index: i,
          id: rule.id,
          error: validation.error!,
        };

        if (validation.suggestion) {
          invalidRule.suggestion = validation.suggestion;
        }

        invalidRules.push(invalidRule);
      }
    }

    if (invalidRules.length > 0) {
      spinner.stop("Validation failed");

      console.log("");
      clack.log.error("Validation failed");
      console.log("");
      clack.log.error(`Invalid rule IDs in ${sourcePath}:`);
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
        `Failed to load or validate rules: ${_error instanceof Error ? _error.message : String(_error)}`,
      ),
    );
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
    const syncOptions: {
      configPath: string;
      dryRun: boolean;
      force: boolean;
      interactive: boolean;
      acceptAgent?: string;
    } = {
      configPath,
      dryRun: dryRun,
      force: force,
      interactive: !force,
    };

    if (acceptAgent !== undefined) {
      syncOptions.acceptAgent = acceptAgent;
    }

    let result;

    // First: Auto-pull from primary agent (if enabled)
    if (shouldAutoPull && autoPullAgent) {
      spinner.start(`Auto-pulling from ${autoPullAgent}`);

      // Snapshot current rules for diff calculation
      let beforeRules: AlignRule[] = [];
      try {
        const currentIR = await loadIR(absoluteSourcePath);
        beforeRules = currentIR.rules || [];
      } catch {
        // Ignore errors - might be first sync
      }

      try {
        // Import from agent first
        const importedRules = await importFromAgent(autoPullAgent, cwd);

        // Wrap rules in AlignPack structure for validation
        const imported = {
          id: config.sources?.[0]?.path || ".aligntrue/.rules.yaml",
          version: "1.0.0",
          spec_version: "1",
          rules: importedRules,
        };

        // Validate schema before writing
        const schemaValidation = validateAlignSchema(imported, {
          mode: "solo",
        });

        if (!schemaValidation.valid) {
          spinner.stop("Auto-pull validation failed");
          clack.log.warn(
            `Cannot auto-pull from ${autoPullAgent}: schema validation failed`,
          );
          schemaValidation.errors?.forEach((err) => {
            clack.log.warn(`  - ${err.path}: ${err.message}`);
          });
          clack.log.info(
            `\nFix ${autoPullAgent} files and run: aligntrue sync --accept-agent ${autoPullAgent}`,
          );
        } else {
          // Validate rule IDs
          const invalidIds: Array<{
            id: string;
            error: string;
            suggestion?: string;
          }> = [];

          const rules = (imported as { rules?: AlignRule[] }).rules || [];
          for (const rule of rules) {
            if (!rule) continue;
            const idValidation = validateRuleId(rule.id);
            if (!idValidation.valid) {
              const entry: {
                id: string;
                error: string;
                suggestion?: string;
              } = {
                id: rule.id,
                error: idValidation.error!,
              };
              if (idValidation.suggestion) {
                entry.suggestion = idValidation.suggestion;
              }
              invalidIds.push(entry);
            }
          }

          if (invalidIds.length > 0) {
            spinner.stop("Auto-pull validation failed");
            clack.log.warn(
              `Cannot auto-pull from ${autoPullAgent}: invalid rule IDs`,
            );

            invalidIds.forEach(({ id, error, suggestion }) => {
              clack.log.warn(`  - "${id}": ${error}`);
              if (suggestion) {
                clack.log.info(`    Try: ${suggestion}`);
              }
            });

            clack.log.info(
              `\nFix rule IDs in ${autoPullAgent} files and run: aligntrue sync --accept-agent ${autoPullAgent}`,
            );
          } else {
            // Safe to write - proceed with actual sync
            const pullResult = await engine.syncFromAgent(
              autoPullAgent,
              absoluteSourcePath,
              {
                ...syncOptions,
                interactive: false, // Auto-pull is non-interactive
                defaultResolutionStrategy:
                  config.sync?.on_conflict || "accept_agent",
              },
            );

            spinner.stop(`Auto-pull complete from ${autoPullAgent}`);

            if (!pullResult.success) {
              clack.log.warn(
                `Auto-pull failed: ${pullResult.warnings?.[0] || "Unknown error"}`,
              );
            } else if (pullResult.written && pullResult.written.length > 0) {
              clack.log.success(`Updated IR from ${autoPullAgent}`);

              // Calculate and display diff if enabled
              const showDiff =
                showAutoPullDiff || (config.sync?.show_diff_on_pull ?? true);

              if (showDiff && beforeRules.length > 0) {
                try {
                  const afterIR = await loadIR(absoluteSourcePath);
                  const afterRules = afterIR.rules || [];
                  const diff = calculateRuleDiff(beforeRules, afterRules);

                  const totalChanges =
                    diff.added.length +
                    diff.modified.length +
                    diff.removed.length;

                  if (totalChanges > 0) {
                    clack.log.info("");
                    clack.log.info(
                      colors.cyan(
                        `ℹ Auto-pull from ${autoPullAgent} (${totalChanges} change${totalChanges !== 1 ? "s" : ""}):`,
                      ),
                    );

                    if (showAutoPullDiff) {
                      // Full diff mode
                      const fullDiff = formatFullDiff(diff);
                      fullDiff.forEach((line: string) => {
                        if (line.startsWith("  +")) {
                          clack.log.info(colors.green(line));
                        } else if (line.startsWith("  ~")) {
                          clack.log.info(colors.yellow(line));
                        } else if (line.startsWith("  -")) {
                          clack.log.info(colors.red(line));
                        } else {
                          clack.log.info(line);
                        }
                      });
                    } else {
                      // Brief summary mode (default)
                      const summary = formatDiffSummary(diff);
                      summary.forEach((line: string) => {
                        if (line.startsWith("  +")) {
                          clack.log.info(colors.green(line));
                        } else if (line.startsWith("  ~")) {
                          clack.log.info(colors.yellow(line));
                        } else if (line.startsWith("  -")) {
                          clack.log.info(colors.red(line));
                        } else {
                          clack.log.info(line);
                        }
                      });
                    }
                  }
                } catch (diffErr) {
                  // Non-critical - continue even if diff fails
                  clack.log.warn(
                    `Could not calculate diff: ${diffErr instanceof Error ? diffErr.message : String(diffErr)}`,
                  );
                }
              }
            }
          }
        }
      } catch (_error) {
        spinner.stop("Auto-pull failed");
        clack.log.warn(
          `Auto-pull error: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
        clack.log.info("Continuing with sync...");
      }
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

      // Show conflicts
      if (result.conflicts && result.conflicts.length > 0) {
        clack.log.warn(
          `${result.conflicts.length} conflict${result.conflicts.length !== 1 ? "s" : ""} detected`,
        );
        result.conflicts.forEach((conflict) => {
          clack.log.info(
            `  ${conflict.ruleId}.${conflict.field}: IR=${JSON.stringify(conflict.irValue)} vs Agent=${JSON.stringify(conflict.agentValue)}`,
          );
        });
      }

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

      // Update last sync timestamp (for conflict detection)
      if (!dryRun) {
        try {
          const detector = new EditDetector(cwd);
          detector.updateLastSyncTimestamp();
        } catch {
          // Non-critical - continue even if timestamp update fails
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
        clack.log.info("Lockfile drift detected. Options:");
        clack.log.info(
          "  1. Review changes and update lockfile: aligntrue lock",
        );
        clack.log.info(
          "  2. Set lockfile.mode: soft in config for warnings only",
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
