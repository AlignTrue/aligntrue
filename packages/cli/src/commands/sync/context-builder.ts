/**
 * Sync context builder - loads config, sources, exporters, and detects agents
 */

import { existsSync, writeFileSync, statSync, unlinkSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  SyncEngine,
  type AlignTrueConfig,
  saveMinimalConfig,
} from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
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
  isMultiFileFormat,
} from "../../utils/detection-output-formatter.js";
import {
  getExporterFromEditSource,
  getAgentDisplayName,
} from "../../utils/edit-source-agent-mapping.js";
import { categorizeDetectedAgents } from "../../utils/edit-source-helpers.js";
import { prepareEditSourceSwitch } from "../../utils/edit-source-content-merger.js";
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
 * Generate fingerprint for section (matching schema behavior)
 */
function generateFingerprint(heading: string): string {
  return createHash("sha256")
    .update(heading.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

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
  const spinnerOpts: { disabled?: boolean } = {};
  if (options.quiet !== undefined) {
    spinnerOpts.disabled = options.quiet;
  }
  const spinner = createSpinner(spinnerOpts);
  if (!options.quiet) {
    spinner.start("Loading configuration");
  }

  let config: AlignTrueConfig = await loadConfigWithValidation(configPath);
  if (!options.quiet) {
    spinner.stop(options.verbose ? "Configuration loaded" : undefined);
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
    const resolveOpts: {
      cwd: string;
      offlineMode?: boolean;
      forceRefresh?: boolean;
      warnConflicts: boolean;
      onGitProgress: (update: GitProgressUpdate) => void;
    } = {
      cwd,
      warnConflicts: true,
      onGitProgress: handleGitProgress,
    };

    const offlineVal = options.offline || options.skipUpdateCheck;
    if (offlineVal !== undefined) {
      resolveOpts.offlineMode = offlineVal;
    }
    if (options.forceRefresh !== undefined) {
      resolveOpts.forceRefresh = options.forceRefresh;
    }

    bundleResult = await resolveAndMergeSources(config, resolveOpts);

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
      spinner.stop(
        bundleResult.sources.length > 1
          ? `Resolved and merged ${bundleResult.sources.length} sources`
          : "Source resolved",
      );
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

  // Step 4: Unified agent detection and onboarding
  // Detects new agents, handles edit source upgrades, and enables exporters
  if (!options.noDetect && !options.dryRun) {
    const changed = await handleAgentDetectionAndOnboarding(
      cwd,
      config,
      configPath,
      options,
    );

    if (changed) {
      if (options.verbose) {
        clack.log.info("Configuration or sources changed, reloading...");
      }

      // Reload config
      const newConfig = await loadConfigWithValidation(configPath);
      // Update config object
      // We can't just assign to config because it's a let, but resolveAndMergeSources uses it
      config = newConfig;

      // Disable auto-pull for this run since we just performed onboarding actions
      // This prevents auto-pull from immediately overwriting our work
      if (!config.sync) config.sync = {};
      config.sync.auto_pull = false;

      // Re-resolve sources
      if (!options.quiet) {
        spinner.start("Refreshing sources");
      }

      try {
        // Create a temporary config copy without edit_source for resolution
        // This forces reading from the IR file (.rules.yaml) which we just updated with merged content
        // Otherwise it would read from the new edit_source files which don't have the merged content yet
        const resolveConfig = { ...config };
        if (resolveConfig.sync) {
          resolveConfig.sync = { ...resolveConfig.sync };
          delete resolveConfig.sync.edit_source;
        }

        const resolveOpts2: {
          cwd: string;
          offlineMode?: boolean;
          forceRefresh: boolean;
          warnConflicts: boolean;
          onGitProgress: (update: GitProgressUpdate) => void;
        } = {
          cwd,
          forceRefresh: true, // Force refresh since files changed
          warnConflicts: true,
          onGitProgress: handleGitProgress,
        };

        const offlineVal2 = options.offline || options.skipUpdateCheck;
        if (offlineVal2 !== undefined) {
          resolveOpts2.offlineMode = offlineVal2;
        }

        bundleResult = await resolveAndMergeSources(
          resolveConfig,
          resolveOpts2,
        );

        // Update paths
        sourcePath =
          config.sources?.[0]?.type === "local"
            ? config.sources[0].path || paths.rules
            : bundleResult.sources[0]?.sourcePath || ".aligntrue/.rules.yaml";

        absoluteSourcePath =
          config.sources?.[0]?.type === "local"
            ? resolve(cwd, sourcePath)
            : sourcePath;

        if (!options.quiet) {
          spinner.stop(
            bundleResult.sources.length > 1
              ? `Refreshed and merged ${bundleResult.sources.length} sources`
              : "Sources refreshed",
          );
        }
      } catch (err) {
        if (!options.quiet) {
          spinner.stop("Source refresh failed");
        }
        throw ErrorFactory.fileWriteFailed(
          "refresh",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
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
      spinner.stop(
        options.verbose
          ? `Loaded ${loadedCount} exporter${loadedCount !== 1 ? "s" : ""}`
          : undefined,
      );
      if (options.verbose && loadedCount > 0) {
        const names = exporterNames.slice(0, loadedCount).join(", ");
        clack.log.success(`Active: ${names}`);
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
      spinner.stop(options.verbose ? "Rules validated" : undefined);
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
 * Unified handler for agent detection and onboarding
 * Replaces separate edit source detection and exporter enablement flows
 */
async function handleAgentDetectionAndOnboarding(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  options: SyncOptions,
): Promise<boolean> {
  let changed = false;
  const editSource = config.sync?.edit_source;

  // 1. Detect all relevant files/agents
  // Untracked files = potential content to import
  const untrackedFiles = detectUntrackedFiles(cwd, editSource);
  const filesWithContent = untrackedFiles.filter((f) => f.hasContent);

  // New agents = agents present on disk but not in exporters list
  const newAgents = detectNewAgents(
    cwd,
    config.exporters || [],
    config.detection?.ignored_agents || [],
  );

  // 2. Group files by agent for summaries
  const filesByAgent = new Map<string, typeof filesWithContent>();
  for (const file of filesWithContent) {
    if (!filesByAgent.has(file.agent)) {
      filesByAgent.set(file.agent, []);
    }
    filesByAgent.get(file.agent)!.push(file);
  }

  // 3. Consolidate detected agent names
  const detectedAgentNames = new Set<string>();
  filesByAgent.forEach((_, agent) => detectedAgentNames.add(agent));
  newAgents.forEach((a) => detectedAgentNames.add(a.name));

  // Remove current edit source agent from detection list (we already know about it)
  const currentEditSourceAgent = getExporterFromEditSource(editSource);
  if (currentEditSourceAgent) {
    detectedAgentNames.delete(currentEditSourceAgent);
  }

  if (detectedAgentNames.size === 0) {
    return false;
  }

  const uniqueDetectedAgents = Array.from(detectedAgentNames);

  // 4. Categorize into "upgrade candidates" vs "export targets"
  const { upgradeCandidates, exportTargets } = categorizeDetectedAgents(
    uniqueDetectedAgents,
    editSource,
  );

  // 5. Build summaries for display
  const summaries = [];
  const displayNameMap: Record<string, string> = {
    cursor: "Cursor",
    agents: "AGENTS.md",
    claude: "Claude",
    crush: "Crush",
    warp: "Warp",
    gemini: "Gemini",
  };

  for (const agent of uniqueDetectedAgents) {
    const displayName = displayNameMap[agent] || getAgentDisplayName(agent);
    const files = filesByAgent.get(agent) || [];

    // If we have files content stats, use them. Otherwise mock summary for agents detected via detectNewAgents
    if (files.length > 0) {
      summaries.push(buildAgentSummary(agent, displayName, files));
    } else {
      // For agents detected by existence only (no content read yet or directory based)
      const agentInfo = newAgents.find((a) => a.name === agent);
      // Mock a summary for display consistency
      summaries.push({
        agentName: agent,
        displayName,
        fileCount: agentInfo ? 1 : 0, // approximate
        totalSections: 0,
        isMultiFile: isMultiFileFormat(agent),
      });
    }
  }

  // 6. Handle non-interactive mode
  const isNonInteractive = !!(
    options.yes ||
    options.nonInteractive ||
    options.autoEnable ||
    config.detection?.auto_enable
  );

  if (isNonInteractive) {
    return await handleNonInteractiveOnboarding(
      cwd,
      config,
      configPath,
      options,
      upgradeCandidates,
      exportTargets,
      editSource,
    );
  }

  // 7. Interactive Mode Display
  // Show unified detection summary
  const formatOpts: {
    verbose?: boolean;
    verboseFull?: boolean;
    quiet?: boolean;
  } = {};

  if (options.verbose !== undefined) {
    formatOpts.verbose = options.verbose;
  }
  if (options.verboseFull !== undefined) {
    formatOpts.verboseFull = options.verboseFull;
  }
  if (options.quiet !== undefined) {
    formatOpts.quiet = options.quiet;
  }
  const formatted = formatDetectionOutput(summaries, filesByAgent, formatOpts);

  if (formatted.text) {
    console.log(formatted.text);
  }

  // 8. Handle Edit Source Upgrade (if applicable)
  if (upgradeCandidates.length > 0) {
    // We found a better edit source (multi-file) and we are currently single-file
    const agent = upgradeCandidates[0]!; // Take first/best candidate
    const agentDisplayName = getAgentDisplayName(agent);

    const agentPatterns: Record<string, string> = {
      cursor: ".cursor/rules/*.mdc",
      amazonq: ".amazonq/rules/*.md",
      augmentcode: ".augment/rules/*.md",
      kilocode: ".kilocode/rules/*.md",
      kiro: ".kiro/steering/*.md",
    };
    const recommendedSource = agentPatterns[agent] || ".cursor/rules/*.mdc";

    const upgrade = await clack.confirm({
      message: `Upgrade to the more flexible ${agentDisplayName} edit source?\n  ${agentDisplayName} files will become your source of truth.`,
      initialValue: true,
    });

    if (clack.isCancel(upgrade)) {
      clack.cancel("Sync cancelled");
      process.exit(0);
    }

    if (upgrade) {
      const newEditSource = recommendedSource;

      await updateEditSource(
        cwd,
        config,
        configPath,
        editSource,
        newEditSource,
        options,
      );
      changed = true;

      // The upgraded agent is now the edit source, so remove it from export targets if present
      const idx = exportTargets.indexOf(agent);
      if (idx !== -1) exportTargets.splice(idx, 1);
    }
  }

  // 9. Handle Export Targets (Batch)
  // Consolidate all remaining agents (including the old edit source if we upgraded)
  // Note: updateEditSource handles backing up the old source, but we might want to add it as an exporter explicitly?
  // Actually, if we upgraded edit source, the old source (e.g. AGENTS.md) is now just a file.
  // We should check if we want to keep syncing to it.

  if (exportTargets.length > 0) {
    // Filter out ignored agents
    const targetsToPrompt = exportTargets.filter(
      (t: string) => !(config.detection?.ignored_agents || []).includes(t),
    );

    if (targetsToPrompt.length > 0) {
      const targetNames = targetsToPrompt
        .map((t: string) => getAgentDisplayName(t))
        .join(", ");

      const response = await clack.select({
        message: `Enable these detected agents as export targets?\n  ${targetNames}`,
        options: [
          {
            value: "yes",
            label: "Yes, enable and export",
            hint: "Add to exporters list",
          },
          { value: "no", label: "No, skip for now" },
          { value: "review", label: "Review individually" },
        ],
      });

      if (clack.isCancel(response)) {
        clack.cancel("Sync cancelled");
        process.exit(0);
      }

      if (response === "yes") {
        await enableExporters(
          cwd,
          config,
          configPath,
          targetsToPrompt,
          options,
        );
        changed = true;
      } else if (response === "review") {
        // Individual review logic could go here, keeping it simple for now
        for (const agent of targetsToPrompt) {
          const enable = await clack.confirm({
            message: `Enable ${getAgentDisplayName(agent)} as export target?`,
          });
          if (!clack.isCancel(enable) && enable) {
            await enableExporters(cwd, config, configPath, [agent], options);
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

async function handleNonInteractiveOnboarding(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  options: SyncOptions,
  upgradeCandidates: string[],
  exportTargets: string[],
  currentEditSource: string | string[] | undefined,
): Promise<boolean> {
  let changed = false;

  // Auto-upgrade edit source if candidate exists
  if (upgradeCandidates.length > 0) {
    const agent = upgradeCandidates[0]!;
    const agentPatterns: Record<string, string> = {
      cursor: ".cursor/rules/*.mdc",
      amazonq: ".amazonq/rules/*.md",
      augmentcode: ".augment/rules/*.md",
      kilocode: ".kilocode/rules/*.md",
      kiro: ".kiro/steering/*.md",
    };
    const newEditSource = agentPatterns[agent] || ".cursor/rules/*.mdc";

    if (!options.quiet) {
      clack.log.info(
        `Auto-upgrading edit source to ${getAgentDisplayName(agent)} (multi-file)`,
      );
    }

    await updateEditSource(
      cwd,
      config,
      configPath,
      currentEditSource,
      newEditSource,
      options,
    );
    changed = true;

    // Remove from export targets
    const idx = exportTargets.indexOf(agent);
    if (idx !== -1) exportTargets.splice(idx, 1);
  }

  // Auto-enable exporters
  if (exportTargets.length > 0) {
    if (!options.quiet) {
      clack.log.info(`Auto-enabling exporters: ${exportTargets.join(", ")}`);
    }
    await enableExporters(cwd, config, configPath, exportTargets, options);
    changed = true;
  }

  return changed;
}

async function updateEditSource(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  oldSource: string | string[] | undefined,
  newSource: string,
  options: SyncOptions,
): Promise<void> {
  if (!config.sync) config.sync = {};
  config.sync.edit_source = newSource;

  // Add new source agent as exporter if not present
  const newExporter = getExporterFromEditSource(newSource);
  if (
    newExporter &&
    config.exporters &&
    !config.exporters.includes(newExporter)
  ) {
    config.exporters.push(newExporter);
  }

  await saveMinimalConfig(config, configPath);

  try {
    // Load dependencies dynamically
    const { saveIR, updateLastSyncTimestamp } = await import("@aligntrue/core");
    const { parseGenericMarkdown } = await import(
      "@aligntrue/exporters/utils/section-parser"
    );
    // generateFingerprint is now local

    // Prepare edit source switch (backup old files, read new content)
    const result = await prepareEditSourceSwitch(oldSource, newSource, cwd);

    if (result.summary && options.verbose) {
      clack.log.info(result.summary);
    } else if (result.backedUpFiles.length > 0) {
      // Always inform user about backups, even if not verbose (unless quiet)
      if (!options.quiet) {
        clack.log.info(
          `Backed up previous rules to: .aligntrue/overwritten-rules/`,
        );
      }
    }

    // Delete old files to ensure clean sync (prevent exporters from preserving "old" content)
    for (const file of result.backedUpFiles) {
      try {
        const fullPath = join(cwd, file);
        unlinkSync(fullPath);
      } catch {
        // Ignore deletion errors (file may not exist anymore)
      }
    }

    // If we have content, parse and update IR
    if (result.content) {
      // Parse merged content into sections
      // We use generic markdown parser which works for both AGENTS.md and most rule files
      const parsed = parseGenericMarkdown(result.content);

      if (parsed.sections.length > 0) {
        // Convert to AlignSection format
        const newSections = parsed.sections.map((s) => ({
          heading: s.heading,
          content: s.content,
          level: s.level,
          fingerprint: generateFingerprint(s.heading),
        }));

        // Replace IR completely (New Source As Truth)
        const currentIR = {
          id: "merged-rules",
          version: "1.0.0",
          spec_version: "1",
          sections: newSections,
        } as AlignPack;

        // Save updated IR
        const irPath = join(cwd, ".aligntrue/.rules.yaml");
        await saveIR(irPath, currentIR);

        // Update last sync timestamp to prevent immediate two-way sync from overwriting our work
        // This marks current files as "synced" so they aren't treated as new edits
        updateLastSyncTimestamp(cwd);

        if (options.verbose) {
          clack.log.success(
            `Updated IR with ${newSections.length} sections from new source`,
          );
        }
      }
    }
  } catch (err) {
    clack.log.warn(
      `Failed to switch edit source cleanly: ${err instanceof Error ? err.message : String(err)}`,
    );
    // Fallback to simple backup behavior (old behavior) if merge fails
    // Backup old source if it was single file
    if (oldSource && !Array.isArray(oldSource)) {
      const { backupFileToOverwrittenRules } = await import(
        "../../utils/extract-rules.js"
      );
      const currentSourcePath = resolve(cwd, oldSource);
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
  }
}

async function enableExporters(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  agents: string[],
  options: SyncOptions,
): Promise<void> {
  const { extractAndSaveRules, backupFileToOverwrittenRules } = await import(
    "../../utils/extract-rules.js"
  );

  // Load current IR for deduplication if available
  let currentIR;
  try {
    const { loadIR } = await import("@aligntrue/core");
    const irPath = join(cwd, ".aligntrue/.rules.yaml");
    if (existsSync(irPath)) {
      currentIR = await loadIR(irPath);
    }
  } catch {
    // Ignore if IR loading fails
  }

  // Filter unique and not already present
  const toAdd = agents.filter((a) => !(config.exporters || []).includes(a));

  if (toAdd.length === 0) return;

  for (const agent of toAdd) {
    // Logic to backup existing file content if exists
    // (Copied/adapted from detectAndEnableAgents)
    // Find path for agent
    const patterns = await import("../../utils/detect-agents.js").then(
      (m) => m.AGENT_PATTERNS[agent] || [],
    );
    const agentFile = patterns.find((p) => existsSync(join(cwd, p)));

    if (agentFile) {
      try {
        const fullPath = join(cwd, agentFile);
        const stats = statSync(fullPath);
        if (stats.isFile()) {
          // Extract content to extracted-rules.md before backing up
          // Only if content extraction enabled (implicit default)
          try {
            const extractionResult = await extractAndSaveRules(
              fullPath,
              undefined, // Auto-detect format
              cwd,
              currentIR,
            );

            if (extractionResult.extracted && options.verbose) {
              clack.log.info(
                `Extracted ${extractionResult.sectionCount} rule section(s) from ${agent} to extracted-rules.md`,
              );
            }
          } catch (extractErr) {
            // Log but don't block enablement
            if (options.verbose) {
              clack.log.warn(
                `Failed to extract rules from ${agentFile}: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`,
              );
            }
          }

          const backupResult = backupFileToOverwrittenRules(fullPath, cwd);
          if (backupResult.backed_up && options.verbose) {
            clack.log.info(
              `Backed up existing ${agent} file to: ${backupResult.backup_path}`,
            );
          }
        }
      } catch {
        // ignore backup errors
      }
    }
  }

  if (!config.exporters) config.exporters = [];
  config.exporters.push(...toAdd);
  await saveMinimalConfig(config, configPath);

  if (!options.quiet) {
    clack.log.success(
      `Enabled exporters: ${toAdd.map((a) => getAgentDisplayName(a)).join(", ")}`,
    );
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
