/**
 * Sync context builder - loads config, sources, exporters, and detects agents
 */

import { existsSync, writeFileSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  SyncEngine,
  type AlignTrueConfig,
  saveMinimalConfig,
} from "@aligntrue/core";
import { ExporterRegistry } from "@aligntrue/exporters";
import { loadConfigWithValidation } from "../../utils/config-loader.js";
import { AlignTrueError, ErrorFactory } from "../../utils/error-types.js";
import {
  detectNewAgents,
  detectUntrackedFiles,
} from "../../utils/detect-agents.js";
import {
  formatDetectionOutput,
  buildAgentSummary,
  shouldRecommendEditSourceSwitch,
} from "../../utils/detection-output-formatter.js";
import {
  getExporterFromEditSource,
  getAgentDisplayName,
} from "../../utils/edit-source-agent-mapping.js";
import { resolveAndMergeSources } from "../../utils/source-resolver.js";
import { UpdatesAvailableError } from "@aligntrue/sources";
import type { GitProgressUpdate } from "../../utils/git-progress.js";
import { createSpinner, SpinnerLike } from "../../utils/spinner.js";
import type { SyncOptions } from "./options.js";
import { getInvalidExporters } from "../../utils/exporter-validation.js";

// Get the exporters package directory for adapter discovery
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Sync context containing all loaded resources
 */
export interface SyncContext {
  cwd: string;
  config: AlignTrueConfig;
  configPath: string;
  sourcePath: string;
  absoluteSourcePath: string;
  bundleResult: Awaited<ReturnType<typeof resolveAndMergeSources>>;
  engine: SyncEngine;
  registry: ExporterRegistry;
  spinner: SpinnerLike;
  lockfilePath?: string;
  lockfileWritten?: boolean;
}

/**
 * Build sync context by loading all necessary resources
 */
export async function buildSyncContext(
  options: SyncOptions,
): Promise<SyncContext> {
  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath = options.configPath || paths.config;

  // Step 1: Check if AlignTrue is initialized
  if (!existsSync(configPath)) {
    throw ErrorFactory.configNotFound(configPath);
  }

  // Step 2: Load config
  const spinner = createSpinner({ disabled: options.quiet });
  if (!options.quiet) {
    spinner.start("Loading configuration");
  }

  const config: AlignTrueConfig = await loadConfigWithValidation(configPath);
  if (!options.quiet) {
    if (options.verbose) {
      spinner.stop("Configuration loaded");
    } else {
      spinner.stop();
    }
  }

  const spinnerWithMessage = spinner as SpinnerLike & {
    message?: (text: string) => void;
  };
  const gitProgressState = {
    lastMessage: "",
    lastUpdate: 0,
  };
  const updateSpinnerMessage = (message: string) => {
    if (!message) {
      return;
    }
    if (spinnerWithMessage.message) {
      spinnerWithMessage.message(message);
    } else {
      clack.log.info(message);
    }
  };
  const handleGitProgress = (update: GitProgressUpdate) => {
    const message = update.message?.trim();
    if (!message) {
      return;
    }
    const now = Date.now();
    if (
      message === gitProgressState.lastMessage &&
      now - gitProgressState.lastUpdate < 500
    ) {
      return;
    }
    updateSpinnerMessage(message);
    gitProgressState.lastMessage = message;
    gitProgressState.lastUpdate = now;
  };

  try {
    const invalidExporters = await getInvalidExporters(config.exporters);
    if (invalidExporters.length > 0) {
      const message = invalidExporters
        .map((issue) =>
          issue.suggestion
            ? `Unknown exporter "${issue.name}" (did you mean "${issue.suggestion}"?)`
            : `Unknown exporter "${issue.name}"`,
        )
        .join("; ");
      throw ErrorFactory.invalidConfig(
        `${message}. Run 'aligntrue adapters list' to see available adapters.`,
      );
    }
  } catch (error) {
    if (error instanceof AlignTrueError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw ErrorFactory.invalidConfig(
      `Failed to validate exporters: ${message}`,
    );
  }

  // Step 3: Resolve sources (local, git, or bundle merge)
  if (!options.quiet) {
    spinner.start("Resolving sources");
  }

  let sourcePath: string;
  let absoluteSourcePath: string;
  let bundleResult: Awaited<ReturnType<typeof resolveAndMergeSources>>;

  try {
    bundleResult = await resolveAndMergeSources(config, {
      cwd,
      offlineMode: options.offline || options.skipUpdateCheck,
      forceRefresh: options.forceRefresh,
      warnConflicts: true,
      onGitProgress: handleGitProgress,
    });

    // Use first source path for conflict detection and display
    sourcePath =
      config.sources?.[0]?.type === "local"
        ? config.sources[0].path || paths.rules
        : bundleResult.sources[0]?.sourcePath || ".aligntrue/.rules.yaml";

    absoluteSourcePath =
      config.sources?.[0]?.type === "local"
        ? resolve(cwd, sourcePath)
        : sourcePath;

    if (!options.quiet) {
      if (options.verbose) {
        spinner.stop(
          bundleResult.sources.length > 1
            ? `Resolved and merged ${bundleResult.sources.length} sources`
            : "Source resolved",
        );
      } else {
        spinner.stop();
      }
    }

    // Show merge info if multiple sources
    if (bundleResult.sources.length > 1 && !options.quiet) {
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
    if (!options.quiet) {
      spinner.stop("Source resolution failed");
    }

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
          `  1. Approve via git PR:  Review and merge changes to config`,
        );
        console.log(
          `  2. Skip update check:   aligntrue sync --skip-update-check`,
        );
        console.log(`  3. Work offline:        aligntrue sync --offline`);
        console.log("\n");
        process.exit(1);
      }

      // Solo mode should auto-update, so this shouldn't happen
      console.error("Unexpected: UpdatesAvailableError in solo mode");
      process.exit(1);
    }

    // Other errors
    const sourceName =
      config.sources?.[0]?.type === "local"
        ? config.sources[0].path || "unknown"
        : config.sources?.[0]?.url || "unknown";
    throw ErrorFactory.fileWriteFailed(
      sourceName,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Step 4: Detect untracked files with content (unless --no-detect or --dry-run)
  // This determines edit_source first, which affects subsequent agent detection
  if (!options.noDetect && !options.dryRun) {
    await detectAndHandleUntrackedFiles(cwd, config, configPath, options);
  }

  // Step 4.5: Detect new agents (unless --no-detect or --dry-run)
  if (!options.noDetect && !options.dryRun) {
    await detectAndEnableAgents(config, configPath, options);
  }

  let lockfilePath: string | undefined;
  let lockfileWritten = false;

  // Step 5: Write lockfile in team mode
  if (config.mode === "team" && config.modules?.lockfile) {
    lockfilePath = resolve(cwd, ".aligntrue.lock.json");

    const { generateLockfile, writeLockfile } = await import(
      "@aligntrue/core/lockfile"
    );
    const newLockfile = generateLockfile(
      bundleResult.pack,
      config.mode as "team" | "enterprise",
    );

    try {
      writeLockfile(lockfilePath, newLockfile);
      lockfileWritten = true;
    } catch (err) {
      throw ErrorFactory.fileWriteFailed(
        ".aligntrue.lock.json",
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!existsSync(lockfilePath)) {
      throw ErrorFactory.fileWriteFailed(
        ".aligntrue.lock.json",
        "Lockfile missing after write attempt",
      );
    }
  }

  // Step 6: Check for new agents (with caching)
  if (!options.dryRun && !options.acceptAgent) {
    await checkAgentsWithCache(cwd, config, configPath, options);
  }

  // Step 7: Load exporters
  if (!options.quiet) {
    spinner.start("Loading exporters");
  }

  const engine = new SyncEngine();
  const registry = new ExporterRegistry();

  try {
    // Discover adapters from exporters package
    let exportersDistPath: string;
    try {
      const exportersPackagePath = await import.meta.resolve(
        "@aligntrue/exporters",
      );
      const exportersIndexPath = fileURLToPath(exportersPackagePath);
      exportersDistPath = dirname(exportersIndexPath);
    } catch {
      exportersDistPath = resolve(__dirname, "../../../../exporters/dist");
    }
    const manifestPaths = registry.discoverAdapters(exportersDistPath);

    // Load manifests and handlers for configured exporters
    const exporterNames = config.exporters || ["cursor", "agents"];
    let loadedCount = 0;

    for (const exporterName of exporterNames) {
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

    if (!options.quiet) {
      if (options.verbose) {
        spinner.stop(
          `Loaded ${loadedCount} exporter${loadedCount !== 1 ? "s" : ""}`,
        );
        if (loadedCount > 0) {
          const names = exporterNames.slice(0, loadedCount).join(", ");
          clack.log.success(`Active: ${names}`);
        }
      } else {
        spinner.stop();
      }
    }
  } catch (_error) {
    if (!options.quiet) {
      spinner.stop("Exporter loading failed");
    }
    throw ErrorFactory.syncFailed(
      `Failed to load exporters: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  // Step 8: Validate rules
  if (!options.quiet) {
    spinner.start("Validating rules");
  }

  try {
    const sections = bundleResult.pack.sections || [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;
      // Section validation happens at parse time
    }
    if (!options.quiet) {
      if (options.verbose) {
        spinner.stop("Rules validated");
      } else {
        spinner.stop();
      }
    }
  } catch (_error) {
    if (!options.quiet) {
      spinner.stop("Validation failed");
    }
    throw ErrorFactory.syncFailed(
      `Failed to validate rules: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  // Step 9: Write merged bundle to local IR
  if (bundleResult.sources.length > 0) {
    try {
      const yaml = await import("yaml");
      const bundleYaml = yaml.stringify(bundleResult.pack);

      const targetPath =
        config.sources?.[0]?.type === "local"
          ? resolve(cwd, config.sources[0].path || paths.rules)
          : resolve(cwd, paths.rules);

      writeFileSync(targetPath, bundleYaml, "utf-8");
      absoluteSourcePath = targetPath;
    } catch (err) {
      throw ErrorFactory.fileWriteFailed(
        "merged bundle",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const context: SyncContext = {
    cwd,
    config,
    configPath,
    sourcePath,
    absoluteSourcePath,
    bundleResult,
    engine,
    registry,
    spinner,
  };

  if (lockfilePath) {
    context.lockfilePath = lockfilePath;
    context.lockfileWritten = lockfileWritten;
  }

  return context;
}

/**
 * Detect and enable new agents
 * When enabling, extracts existing agent content to extracted-rules.md before overwriting
 */
async function detectAndEnableAgents(
  config: AlignTrueConfig,
  configPath: string,
  options: SyncOptions,
): Promise<void> {
  const cwd = process.cwd();
  let newAgents = detectNewAgents(
    cwd,
    config.exporters || [],
    config.detection?.ignored_agents || [],
  );

  // Filter out the edit source agent to avoid prompting about it
  // (it's already being used as the edit source, so it should be auto-enabled)
  const editSourceAgent = getExporterFromEditSource(config.sync?.edit_source);
  if (editSourceAgent) {
    newAgents = newAgents.filter((a) => a.name !== editSourceAgent);
  }

  if (newAgents.length === 0) return;

  const shouldAutoEnable =
    options.autoEnable ||
    options.yes ||
    options.nonInteractive ||
    config.detection?.auto_enable;

  // Load current IR for deduplication when extracting old rules
  const paths = getAlignTruePaths(cwd);
  const { loadIR } = await import("@aligntrue/core");
  let currentIR;
  try {
    currentIR = await loadIR(paths.rules, { config });
  } catch {
    // IR may not exist yet, that's OK
  }

  const { extractAndSaveRules, backupFileToOverwrittenRules } = await import(
    "../../utils/extract-rules.js"
  );

  if (shouldAutoEnable) {
    // Auto-enable without prompting
    clack.log.info(`Auto-enabling ${newAgents.length} detected agent(s)...`);
    for (const agent of newAgents) {
      // Extract old content if agent file exists and has content
      try {
        const agentFilePath = join(cwd, agent.filePath);
        const stats = statSync(agentFilePath);
        // Only attempt backup if it's a file, not a directory
        if (stats.isFile()) {
          // Backup entire file before overwriting (preserves file structure for recovery)
          const backupResult = backupFileToOverwrittenRules(agentFilePath, cwd);
          if (backupResult.backed_up && options.verbose) {
            clack.log.info(
              `Backed up ${agent.displayName} to: ${backupResult.backup_path}`,
            );
          }
        } else if (stats.isDirectory()) {
          if (options.verbose) {
            clack.log.info(
              `Skipping extraction for ${agent.displayName} (directory format)`,
            );
          }
        }
      } catch (error) {
        clack.log.warn(
          `⚠ Failed to backup ${agent.displayName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      config.exporters!.push(agent.name);
      clack.log.success(`Enabled: ${agent.displayName}`);
    }
    await saveMinimalConfig(config, configPath);
  } else {
    // Prompt for each new agent
    const toEnable: string[] = [];
    const toIgnore: string[] = [];

    // Check if TTY is available for interactive prompts
    const { isTTY } = await import("../../utils/tty-helper.js");
    if (!isTTY()) {
      // Non-TTY environment: treat all new agents as "ignore" to prevent hanging
      clack.log.info(
        `${newAgents.length} new agent${newAgents.length !== 1 ? "s" : ""} detected (non-interactive mode)`,
      );
      clack.log.info(
        "Skipping prompts. Use --auto-enable or add agents manually to enable them.",
      );
      return;
    }

    // Batch prompt for multiple agents
    const agentList = newAgents.map((a) => a.displayName).join(", ");
    clack.log.info(
      `${newAgents.length} new agent${newAgents.length !== 1 ? "s" : ""} detected: ${agentList}`,
    );

    let batchResponse: "yes" | "no" | "review" | symbol;
    if (newAgents.length === 1) {
      // Single agent: show individual prompt
      const agent = newAgents[0]!;
      clack.log.warn(`⚠ New agent detected: ${agent.displayName}`);
      clack.log.info(`  Found: ${agent.filePath}`);

      const response = await clack.select({
        message: `Enable ${agent.displayName} as an export target?\n\nExisting content will be backed up to .aligntrue/overwritten-rules/ and the file will be synced with your current rules.`,
        options: [
          {
            value: "yes",
            label: "Yes, enable and export",
            hint: "Add to exporters list and back up existing content",
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
        return;
      }

      if (response === "yes") {
        toEnable.push(agent.name);
      } else if (response === "never") {
        toIgnore.push(agent.name);
      }
    } else {
      // Multiple agents: show batch prompt
      batchResponse = await clack.select({
        message: `Enable these ${newAgents.length} new agents as export targets?\n\nExisting content will be backed up to .aligntrue/overwritten-rules/ and files will be synced with your current rules.`,
        options: [
          {
            value: "yes",
            label: "Yes, enable all",
            hint: "Enable all detected agents",
          },
          {
            value: "review",
            label: "Review individually",
            hint: "Review each agent separately",
          },
          {
            value: "no",
            label: "No, skip for now",
            hint: "Ask again next time",
          },
        ],
      });

      if (clack.isCancel(batchResponse)) {
        clack.cancel("Detection cancelled");
        return;
      }

      if (batchResponse === "yes") {
        // Enable all
        toEnable.push(...newAgents.map((a) => a.name));
      } else if (batchResponse === "review") {
        // Review individually
        for (const agent of newAgents) {
          clack.log.warn(`⚠ New agent detected: ${agent.displayName}`);
          clack.log.info(`  Found: ${agent.filePath}`);

          const response = await clack.select({
            message: `Enable ${agent.displayName} as an export target?\n\nExisting content will be backed up to .aligntrue/overwritten-rules/ and the file will be synced with your current rules.`,
            options: [
              {
                value: "yes",
                label: "Yes, enable and export",
                hint: "Add to exporters list and back up existing content",
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
      }
    }

    // Update config with choices
    if (toEnable.length > 0 || toIgnore.length > 0) {
      if (toEnable.length > 0) {
        // Extract old content for each enabled agent before adding to config
        for (const agentName of toEnable) {
          const agent = newAgents.find((a) => a.name === agentName);
          if (agent) {
            const agentFilePath = join(cwd, agent.filePath);
            const stats = statSync(agentFilePath);
            // Only attempt extraction if it's a file, not a directory
            if (stats.isFile()) {
              try {
                // Backup entire file before overwriting (preserves file structure)
                const backupResult = backupFileToOverwrittenRules(
                  agentFilePath,
                  cwd,
                );
                if (backupResult.backed_up && options.verbose) {
                  clack.log.info(
                    `Backed up ${agent.displayName} to: ${backupResult.backup_path}`,
                  );
                }

                // Also extract sections for deduplication
                await extractAndSaveRules(
                  agentFilePath,
                  undefined, // Auto-detect format from path
                  cwd,
                  currentIR,
                );
              } catch (error) {
                clack.log.warn(
                  `⚠ Failed to extract rules from ${agent.displayName}: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            } else if (stats.isDirectory()) {
              if (options.verbose) {
                clack.log.info(
                  `Skipping extraction for ${agent.displayName} (directory format)`,
                );
              }
            }
          }
        }

        config.exporters!.push(...toEnable);
        clack.log.success(
          `Enabled ${toEnable.length} agent(s): ${toEnable.join(", ")}`,
        );
        clack.log.info(
          "Review backed up content in .aligntrue/overwritten-rules/ if needed.",
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

/**
 * Detect untracked files with content and prompt user for import strategy
 *
 * Note: This function only runs in interactive mode. When --yes or --non-interactive
 * flags are used, this is skipped to avoid blocking automated workflows.
 *
 * In non-interactive mode, new agent files are auto-detected in separate workflow
 * but not interactively merged. This is intentional to maintain CI/automation reliability.
 */
async function detectAndHandleUntrackedFiles(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  options: SyncOptions,
): Promise<void> {
  const editSource = config.sync?.edit_source;
  const untrackedFiles = detectUntrackedFiles(cwd, editSource);

  // Only proceed if there are untracked files with content
  const filesWithContent = untrackedFiles.filter((f) => f.hasContent);
  if (filesWithContent.length === 0) {
    return;
  }

  // Group files by agent
  const filesByAgent = new Map<string, typeof filesWithContent>();
  for (const file of filesWithContent) {
    if (!filesByAgent.has(file.agent)) {
      filesByAgent.set(file.agent, []);
    }
    filesByAgent.get(file.agent)!.push(file);
  }

  // Build summaries for formatted output
  const summaries = [];
  const displayNameMap: Record<string, string> = {
    cursor: "Cursor",
    agents: "AGENTS.md",
    claude: "Claude",
    crush: "Crush",
    warp: "Warp",
    gemini: "Gemini",
  };

  for (const [agent, files] of filesByAgent) {
    const displayName = displayNameMap[agent] || agent;
    summaries.push(buildAgentSummary(agent, displayName, files));
  }

  // Check if we should recommend edit_source switch
  const detectedAgents = Array.from(filesByAgent.keys());
  const switchRecommendation = shouldRecommendEditSourceSwitch(
    detectedAgents,
    editSource,
  );

  // In non-interactive mode (--yes), automatically set edit_source if needed
  const isNonInteractive = options.yes || options.nonInteractive;
  let newEditSource: string | undefined;

  if (isNonInteractive && switchRecommendation.should_recommend) {
    // Auto-set edit_source to multi-file format when detected with --yes
    const agent = switchRecommendation.agent || "cursor";
    const agentPatterns: Record<string, string> = {
      cursor: ".cursor/rules/*.mdc",
      amazonq: ".amazonq/rules/*.md",
      augmentcode: ".augment/rules/*.md",
      kilocode: ".kilocode/rules/*.md",
      kiro: ".kiro/steering/*.md",
    };
    newEditSource = agentPatterns[agent] || ".cursor/rules/*.mdc";

    // Log the change (unless in quiet mode)
    if (!options.quiet && editSource && editSource !== newEditSource) {
      clack.log.info(
        `Auto-switching edit_source from "${editSource}" to "${newEditSource}" (multi-file ${agent} detected)`,
      );
    }

    // If switching from single-file source, back it up
    if (editSource && !Array.isArray(editSource)) {
      const { backupFileToOverwrittenRules } = await import(
        "../../utils/extract-rules.js"
      );
      const currentSourcePath = resolve(cwd, editSource);
      if (existsSync(currentSourcePath)) {
        const backupResult = backupFileToOverwrittenRules(
          currentSourcePath,
          cwd,
        );
        if (backupResult.backed_up && options.verbose) {
          clack.log.info(
            `Backed up previous edit source to: ${backupResult.backup_path}`,
          );
        }
      }
    }
  } else if (isNonInteractive) {
    // Skip interactive prompts in non-interactive mode
    return;
  } else {
    // Interactive mode - show formatted output and prompt user
    // Format and display detection with tiered verbosity (single consolidated display)
    const formatted = formatDetectionOutput(summaries, filesByAgent, {
      verbose: options.verbose,
      verboseFull: options.verboseFull,
      quiet: options.quiet,
    });

    if (formatted.text) {
      console.log(formatted.text);
    }

    if (switchRecommendation.should_recommend) {
      // Recommend switching to multi-file format
      const agent = switchRecommendation.agent || "cursor";
      const agentPatterns: Record<string, string> = {
        cursor: ".cursor/rules/*.mdc",
        amazonq: ".amazonq/rules/*.md",
        augmentcode: ".augment/rules/*.md",
        kilocode: ".kilocode/rules/*.md",
        kiro: ".kiro/steering/*.md",
      };
      const recommendedSource = agentPatterns[agent] || ".cursor/rules/*.mdc";

      const agentDisplayName = getAgentDisplayName(agent);
      const recommendation = await clack.confirm({
        message: `Upgrade to the more flexible ${agentDisplayName} edit source?\n  Found ${filesByAgent.get(agent)?.length || 0} files. Preserves file organization and improves scalability.`,
        initialValue: true,
      });

      if (clack.isCancel(recommendation)) {
        clack.cancel("Sync cancelled");
        process.exit(0);
      }

      if (recommendation) {
        newEditSource = recommendedSource;
        // If switching from single-file source, back it up
        if (editSource && !Array.isArray(editSource)) {
          const { backupFileToOverwrittenRules } = await import(
            "../../utils/extract-rules.js"
          );
          const currentSourcePath = resolve(cwd, editSource);
          const backupResult = backupFileToOverwrittenRules(
            currentSourcePath,
            cwd,
          );
          if (backupResult.backed_up) {
            clack.log.info(
              `Backed up previous edit source to: ${backupResult.backup_path}`,
            );
          }
        }
      } else {
        // User declined switch, ask for alternative
        const altChoice = await clack.select({
          message: "Choose edit source instead:",
          options: [
            { value: "AGENTS.md", label: "AGENTS.md (recommended)" },
            { value: "CLAUDE.md", label: "CLAUDE.md" },
          ],
        });

        if (clack.isCancel(altChoice)) {
          clack.cancel("Sync cancelled");
          process.exit(0);
        }

        newEditSource = altChoice as string;
      }
    } else if (detectedAgents.length > 0) {
      // Single-file formats detected
      const options_choices: Array<{ value: string; label: string }> = [];
      for (const agent of detectedAgents) {
        const displayNameMap: Record<string, string> = {
          agents: "AGENTS.md",
          claude: "CLAUDE.md",
        };
        const filename = displayNameMap[agent] || `${agent.toUpperCase()}.md`;
        options_choices.push({ value: filename, label: filename });
      }

      if (options_choices.length === 1) {
        newEditSource = options_choices[0]!.value;
        clack.log.info(`Using ${newEditSource} as edit source`);
      } else {
        const choice = await clack.select({
          message: "Choose edit source:",
          options: options_choices,
        });

        if (clack.isCancel(choice)) {
          clack.cancel("Sync cancelled");
          process.exit(0);
        }

        newEditSource = choice as string;
      }
    }
  }

  // Update config with new edit source
  if (newEditSource) {
    if (!config.sync) config.sync = {};
    const previousEditSource = config.sync.edit_source;
    config.sync.edit_source = newEditSource;

    // Auto-enable the new edit source agent as an exporter
    const newExporter = getExporterFromEditSource(newEditSource);
    if (newExporter && config.exporters) {
      if (!config.exporters.includes(newExporter)) {
        config.exporters.push(newExporter);
      }
    }

    await saveMinimalConfig(config, configPath);
    if (!isNonInteractive) {
      if (previousEditSource && previousEditSource !== newEditSource) {
        clack.log.success(
          `Edit source updated from "${previousEditSource}" to "${newEditSource}"`,
        );
      } else {
        clack.log.success(`Edit source set to: ${newEditSource}`);
      }
      clack.log.info(
        "Content will be read from edit source and exported to all agents on next sync.",
      );
    }
  }
}

/**
 * Check for new agents with caching
 */
async function checkAgentsWithCache(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  options: SyncOptions,
): Promise<void> {
  const { loadDetectionCache, saveDetectionCache } = await import(
    "@aligntrue/core"
  );
  const { detectAgentsWithValidation, shouldWarnAboutDetection } = await import(
    "../../utils/detect-agents.js"
  );

  const detection = detectAgentsWithValidation(cwd, config.exporters || []);
  const cache = loadDetectionCache(cwd);

  if (shouldWarnAboutDetection(detection, cache)) {
    if (detection.missing.length > 0) {
      clack.log.warn(`New agents detected: ${detection.missing.join(", ")}`);

      if (!options.yes && !options.nonInteractive) {
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
