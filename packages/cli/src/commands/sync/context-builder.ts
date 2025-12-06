/**
 * Sync context builder - loads config, sources, exporters, and detects agents
 */

import {
  existsSync,
  writeFileSync,
  statSync,
  readdirSync,
  readFileSync,
} from "fs";
import { dirname, join, resolve, sep } from "path";
import { createHash } from "crypto";
import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  SyncEngine,
  type AlignTrueConfig,
  patchConfig,
  getExporterNames,
  loadMergedConfig,
  isLegacyTeamConfig,
  type ConfigWarning,
  detectNestedAgentFiles,
} from "@aligntrue/core";
import { ExporterRegistry } from "@aligntrue/exporters";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import { loadConfigWithValidation } from "../../utils/config-loader.js";
import {
  AlignTrueError,
  ErrorFactory,
  TeamModeError,
} from "../../utils/error-types.js";
import { discoverExporterManifests } from "../../utils/exporter-validation.js";

import { resolveAndMergeSources } from "../../utils/source-resolver.js";

function getAgentDisplayName(agent: string): string {
  const displayNames: Record<string, string> = {
    cursor: "Cursor",
    agents: "AGENTS.md",
    claude: "Claude",
    copilot: "Copilot",
    windsurf: "Windsurf",
    aider: "Aider",
    "gemini-cli": "Gemini CLI",
  };
  return displayNames[agent] || agent;
}

async function _prepareEditSourceSwitch(
  _oldSource: string | string[] | undefined,
  _newSource: string,
  _cwd: string,
): Promise<{
  summary?: string;
  content?: string;
  backedUpFiles: string[];
  sections: Array<{
    heading: string;
    content: string;
    level: number;
    fingerprint: string;
  }>;
}> {
  return { backedUpFiles: [], sections: [] };
}
import { UpdatesAvailableError } from "@aligntrue/sources";
import type { GitProgressUpdate } from "../../utils/git-progress.js";
import { createManagedSpinner, type SpinnerLike } from "../../utils/spinner.js";
import type { SyncOptions } from "./options.js";
import { getInvalidExporters } from "../../utils/exporter-validation.js";
import { buildBackupRestoreHint } from "../../utils/backup-hints.js";

/**
 * Generate fingerprint for section (matching schema behavior)
 */
function _generateFingerprint(heading: string): string {
  return createHash("sha256")
    .update(heading.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

/**
 * Detect non-.md files in a rules directory (recursive)
 */
async function detectNonMdFilesInRulesDir(dir: string): Promise<string[]> {
  const nonMdFiles: string[] = [];

  function scanDir(currentDir: string, prefix: string = ""): void {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue; // Skip hidden files

        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          scanDir(join(currentDir, entry.name), relativePath);
        } else if (entry.isFile()) {
          const ext = entry.name.split(".").pop()?.toLowerCase();
          if (
            ext &&
            ext !== "md" &&
            ext !== "mdc" &&
            ext !== entry.name // protect files without extension
          ) {
            nonMdFiles.push(relativePath);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  scanDir(dir);
  return nonMdFiles;
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
    const error = ErrorFactory.configNotFound(configPath);
    const backupHint = buildBackupRestoreHint(cwd);
    if (backupHint) {
      error.hint = error.hint ? `${error.hint}\n${backupHint}` : backupHint;
    }
    throw error;
  }

  // Step 2: Load config (with two-file config support)
  const spinnerOpts: { disabled?: boolean } = {};
  if (options.quiet !== undefined) {
    spinnerOpts.disabled = options.quiet;
  }
  const spinner = createManagedSpinner(spinnerOpts);
  if (options.verbose) {
    spinner.start("Loading configuration");
  }

  // Use merged config loader for two-file config support
  let config: AlignTrueConfig;
  let configWarnings: ConfigWarning[] = [];
  let isTeamMode = false;

  try {
    const mergeResult = await loadMergedConfig(cwd);
    config = mergeResult.config;
    configWarnings = mergeResult.warnings;
    isTeamMode = mergeResult.isTeamMode;

    // Check for missing team config (team artifacts exist but config.team.yaml is missing)
    if (!isTeamMode && existsSync(paths.lockfile)) {
      // Lockfile exists but not in team mode - might be missing team config
      if (!existsSync(paths.teamConfig) && !isLegacyTeamConfig(cwd)) {
        configWarnings.push({
          field: "config.team.yaml",
          message:
            "Team config file missing (.aligntrue/config.team.yaml)\n" +
            "  This project has team artifacts but no team config.\n" +
            "  To recover:\n" +
            "  - Check git: git checkout -- .aligntrue/config.team.yaml\n" +
            "  - Ask a teammate to share their copy\n" +
            "  - Re-create: aligntrue team enable\n" +
            "  Continuing in solo mode...",
          level: "warn",
        });
      }
    }
  } catch {
    // Fall back to single config if merge fails
    config = await loadConfigWithValidation(configPath);
  }

  if (options.verbose) {
    spinner.stop("Configuration loaded");
  }

  // Display config warnings (non-blocking)
  if (configWarnings.length > 0 && !options.quiet) {
    for (const warning of configWarnings) {
      if (warning.level === "warn") {
        clack.log.warn(warning.message);
      } else {
        clack.log.info(warning.message);
      }
    }
  }

  // Auto-import detected agent files outside .aligntrue/rules by extracting content
  // Skip entirely in dry-run to avoid side effects
  if (!options.dryRun) {
    const detectedAgentFiles = await detectNestedAgentFiles(cwd);
    const rulesDir = paths.rules;
    const extractedRulesPath = join(rulesDir, "extracted-rules.md");
    const exportersToEnable = new Set<string>();

    for (const file of detectedAgentFiles) {
      // Skip files already under the managed rules directory
      if (file.path.includes(`${sep}.aligntrue${sep}rules${sep}`)) continue;

      try {
        const content = readFileSync(file.path, "utf-8").trim();
        if (!content) continue;

        ensureDirectoryExists(rulesDir);

        const header = [
          "\n",
          "## Extracted from: ",
          file.relativePath,
          "\n\n",
          content,
          content.endsWith("\n") ? "" : "\n",
        ].join("");

        writeFileSync(
          extractedRulesPath,
          existsSync(extractedRulesPath)
            ? readFileSync(extractedRulesPath, "utf-8") + header
            : `# Extracted Rules\n${header}`,
          "utf-8",
        );

        // Enable matching exporter so future syncs overwrite the source file
        if (file.type === "cursor") exportersToEnable.add("cursor");
        if (file.type === "agents") exportersToEnable.add("agents");
        if (file.type === "claude") exportersToEnable.add("claude");
      } catch {
        // Non-fatal: continue to next file
      }
    }

    if (exportersToEnable.size > 0) {
      const currentExporters = getExporterNames(config.exporters);
      const updated = [
        ...currentExporters,
        ...[...exportersToEnable].filter((e) => !currentExporters.includes(e)),
      ];
      if (updated.length !== currentExporters.length) {
        await patchConfig({ exporters: updated }, configPath, cwd);
        config.exporters = updated;
        if (!options.quiet) {
          clack.log.info(
            `Auto-enabled exporters for detected agent files: ${[
              ...exportersToEnable,
            ].join(", ")}`,
          );
        }
      }
    }
  }

  // Check for new team member needing personal config
  if (isTeamMode && existsSync(paths.teamConfig) && !existsSync(paths.config)) {
    throw ErrorFactory.invalidConfig(
      "Missing personal config file: .aligntrue/config.yaml\n\n" +
        "This repo uses team mode. New team members need to create a personal config.\n\n" +
        "Run: aligntrue team join\n\n" +
        "This creates your personal config (gitignored) for local settings.\n" +
        "Learn more: https://aligntrue.ai/docs/01-guides/03-join-team",
    );
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
    const invalidExporters = await getInvalidExporters(
      getExporterNames(config.exporters),
    );
    if (invalidExporters.length > 0) {
      const message = invalidExporters
        .map((issue) =>
          issue.suggestion
            ? `Unknown exporter "${issue.name}" (did you mean "${issue.suggestion}"?)`
            : `Unknown exporter "${issue.name}"`,
        )
        .join("; ");
      throw ErrorFactory.invalidConfig(
        `${message}. Run 'aligntrue exporters list' to see available exporters.`,
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
  if (options.verbose) {
    spinner.start("Resolving sources");
  }

  let sourcePath: string;
  let absoluteSourcePath: string;
  let bundleResult: Awaited<ReturnType<typeof resolveAndMergeSources>>;

  // Define resolve options outside try block so catch can reuse with offlineMode
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

  try {
    bundleResult = await resolveAndMergeSources(config, resolveOpts);

    // Use first source path for conflict detection and display
    sourcePath =
      config.sources?.[0]?.type === "local"
        ? config.sources[0].path || paths.rules
        : bundleResult.sources[0]?.sourcePath || ".aligntrue/rules";

    absoluteSourcePath =
      config.sources?.[0]?.type === "local"
        ? resolve(cwd, sourcePath)
        : sourcePath;

    if (options.verbose) {
      spinner.stop(
        bundleResult.sources.length > 1
          ? `Resolved and merged ${bundleResult.sources.length} sources`
          : undefined,
      );
    }

    // Check for non-.md files in rules directory
    if (!options.quiet && existsSync(absoluteSourcePath)) {
      const nonMdFiles = await detectNonMdFilesInRulesDir(absoluteSourcePath);
      if (nonMdFiles.length > 0) {
        const fileList = nonMdFiles.slice(0, 5).join(", ");
        const moreCount =
          nonMdFiles.length > 5 ? ` and ${nonMdFiles.length - 5} more` : "";
        clack.log.warn(
          `Non-markdown files detected in .aligntrue/rules/:\n  ${fileList}${moreCount}\n\n` +
            `Only .md files are processed. Rename to .md if you want them included.`,
        );
      }
    }

    // Show merge info if multiple sources
    if (bundleResult.sources.length > 1 && !options.quiet) {
      // Deduplicate sources by path for cleaner output
      const uniqueSources = bundleResult.sources.reduce(
        (acc, src) => {
          const key = src.sourcePath;
          if (!acc.seen.has(key)) {
            acc.seen.add(key);
            acc.list.push(src);
          }
          return acc;
        },
        { seen: new Set<string>(), list: [] as typeof bundleResult.sources },
      ).list;

      const orderedSources = [...uniqueSources].reverse();
      clack.log.info(
        "Sources merged (highest priority first, last source wins on conflicts):",
      );
      orderedSources.forEach((src, idx) => {
        const priority =
          idx === 0 ? "wins" : idx === orderedSources.length - 1 ? "base" : "";
        const priorityLabel = priority ? ` [${priority}]` : "";
        clack.log.info(
          `  ${idx + 1}. ${src.sourcePath}${src.commitSha ? ` (${src.commitSha.slice(0, 7)})` : ""}${priorityLabel}`,
        );
      });

      if (bundleResult.conflicts && bundleResult.conflicts.length > 0) {
        clack.log.warn(
          `${bundleResult.conflicts.length} merge conflict${bundleResult.conflicts.length !== 1 ? "s" : ""} resolved (last source wins)`,
        );
      }
    }
  } catch (err) {
    if (!options.quiet) {
      spinner.stop("Source resolution failed");
    }

    if (err instanceof AlignTrueError) {
      throw err;
    }

    // Handle git source updates available
    if (err instanceof UpdatesAvailableError) {
      const updateErr = err as UpdatesAvailableError;
      const commitsBehind =
        updateErr.commitsBehind > 0
          ? `Behind by: ${updateErr.commitsBehind} commit${updateErr.commitsBehind !== 1 ? "s" : ""}`
          : undefined;
      const details = [
        `Repository: ${updateErr.url}`,
        `Ref: ${updateErr.ref}`,
        `Current SHA: ${updateErr.currentSha.slice(0, 7)}`,
        `Latest SHA: ${updateErr.latestSha.slice(0, 7)}`,
        commitsBehind,
      ]
        .filter(Boolean)
        .join("\n");

      // In team mode: warn by default, block only with --strict-sources
      if (config.mode === "team") {
        if (options.strictSources) {
          throw new TeamModeError(
            `Git source has updates available:\n${details}`,
            "Strict source checking enabled. Approve updates by merging the source PR.",
          ).withNextSteps([
            "Review and merge changes to the source repository",
            "Or rerun without --strict-sources to allow updates",
            "Or run with --offline to work without updates",
          ]);
        }

        // Warn but continue with cached version (default behavior for team mode)
        if (!options.quiet) {
          clack.log.warn(
            `Git source has updates available:\n${details}\n\n` +
              `Continuing with cached version. To update:\n` +
              `  1. Review and merge changes in the source repository\n` +
              `  2. Or run with --skip-update-check to bypass\n` +
              `  Use --strict-sources to block sync until approved.`,
          );
        }

        // Retry with offline mode to use cached version
        const offlineOpts = { ...resolveOpts, offlineMode: true };
        bundleResult = await resolveAndMergeSources(config, offlineOpts);

        // Continue to rest of context building
        sourcePath =
          config.sources?.[0]?.type === "local"
            ? config.sources[0].path || paths.rules
            : bundleResult.sources[0]?.sourcePath || ".aligntrue/rules";
        absoluteSourcePath =
          config.sources?.[0]?.type === "local"
            ? resolve(cwd, sourcePath)
            : sourcePath;
      } else {
        // Solo mode: warn and continue with cached version (auto-update best effort)
        if (!options.quiet) {
          clack.log.warn(
            `Git source has updates available:\n${details}\n\n` +
              `Continuing with cached version. Solo mode auto-updates when possible.\n` +
              `Use --skip-update-check to suppress this warning or --offline to stay on cache.`,
          );
        }

        // Retry with offline mode to use cached version instead of blocking
        const offlineOpts = { ...resolveOpts, offlineMode: true };
        bundleResult = await resolveAndMergeSources(config, offlineOpts);

        sourcePath =
          config.sources?.[0]?.type === "local"
            ? config.sources[0].path || paths.rules
            : bundleResult.sources[0]?.sourcePath || ".aligntrue/rules";
        absoluteSourcePath =
          config.sources?.[0]?.type === "local"
            ? resolve(cwd, sourcePath)
            : sourcePath;
      }
    } else {
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
  }

  // Note: Lockfile generation moved to workflow.ts (after exports, respects dry-run)

  // Step 5: Check for new agents (with caching)
  if (!options.dryRun) {
    await checkAgentsWithCache(cwd, config, configPath, options);
  }

  // Step 6: Load exporters
  if (options.verbose) {
    spinner.start("Loading exporters");
  }

  const engine = new SyncEngine();
  const registry = new ExporterRegistry();

  try {
    // Discover exporters using shared helper
    const manifestPaths = await discoverExporterManifests(registry);

    // Load manifests and handlers for configured exporters
    const exporterNamesArray = getExporterNames(config.exporters) || [
      "cursor",
      "agents",
    ];
    let loadedCount = 0;

    for (const exporterName of exporterNamesArray) {
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

    if (options.verbose) {
      spinner.stop(
        `Loaded ${loadedCount} exporter${loadedCount !== 1 ? "s" : ""}`,
      );
      if (loadedCount > 0) {
        const names = exporterNamesArray.slice(0, loadedCount).join(", ");
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

  // Step 7: Validate rules
  if (options.verbose) {
    spinner.start("Validating rules");
  }

  try {
    const sections = bundleResult.align.sections || [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;
      // Section validation happens at parse time
    }
    if (options.verbose) {
      spinner.stop("Rules validated");
    }
  } catch (_error) {
    if (!options.quiet) {
      spinner.stop("Validation failed");
    }
    throw ErrorFactory.syncFailed(
      `Failed to validate rules: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  // Step 8: Write merged bundle to local IR (only for file-based sources)
  // Skip for directory-based sources (new rule file format)
  if (bundleResult.sources.length > 0) {
    // For git sources, use a temporary bundle file instead of .aligntrue/rules
    // to preserve the git source as the canonical source
    const isGitSource = config.sources?.[0]?.type === "git";
    const multipleSources = bundleResult.sources.length > 1;
    let targetPath: string;

    if (isGitSource || multipleSources) {
      // Use a temporary bundle file for git sources
      targetPath = resolve(cwd, ".aligntrue/.temp/bundle.yaml");
      const tempDir = dirname(targetPath);
      ensureDirectoryExists(tempDir);
    } else {
      // For local sources, use the configured path or default
      targetPath =
        config.sources?.[0]?.type === "local"
          ? resolve(cwd, config.sources[0].path || paths.rules)
          : resolve(cwd, paths.rules);
    }

    // Write merged bundle to file (skip only when directory target and single source)
    // Uses EAFP pattern to avoid TOCTOU race condition
    try {
      const yaml = await import("yaml");
      const bundleYaml = yaml.stringify(bundleResult.align);
      writeFileSync(targetPath, bundleYaml, "utf-8");
      absoluteSourcePath = targetPath;
    } catch (err) {
      // EISDIR means target is a directory (new format - rules already in place)
      // For multiple sources, directory targets are invalid; use temp bundle instead
      const isDirectoryError =
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "EISDIR";
      if (isDirectoryError && !multipleSources) {
        // For single-source directory, keep absoluteSourcePath as existing directory
      } else if (isDirectoryError && multipleSources) {
        // Fallback: write merged bundle to temp file
        const fallbackPath = resolve(cwd, ".aligntrue/.temp/bundle.yaml");
        const tempDir = dirname(fallbackPath);
        ensureDirectoryExists(tempDir);
        const yaml = await import("yaml");
        const bundleYaml = yaml.stringify(bundleResult.align);
        writeFileSync(fallbackPath, bundleYaml, "utf-8");
        absoluteSourcePath = fallbackPath;
      } else {
        throw ErrorFactory.fileWriteFailed(
          "merged bundle",
          err instanceof Error ? err.message : String(err),
        );
      }
      // For directories, absoluteSourcePath is already set correctly
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

  return context;
}

async function _enableExporters(
  cwd: string,
  config: AlignTrueConfig,
  configPath: string,
  agents: string[],
  options: SyncOptions,
): Promise<void> {
  const { backupOverwrittenFile } = await import("@aligntrue/core");

  // Filter unique and not already present
  const existingExporters = getExporterNames(config.exporters);
  const toAdd = agents.filter((a) => !existingExporters.includes(a));

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
          try {
            const backupPath = backupOverwrittenFile(fullPath, cwd);
            if (options.verbose) {
              clack.log.info(
                `Backed up existing ${agent} file to: ${backupPath}`,
              );
            }
          } catch (backupErr) {
            // Log but don't block enablement
            if (options.verbose) {
              clack.log.warn(
                `Failed to backup ${agentFile}: ${backupErr instanceof Error ? backupErr.message : String(backupErr)}`,
              );
            }
          }
        }
      } catch {
        // ignore backup errors
      }
    }
  }

  // Always use array format for simplicity
  const currentExporters = getExporterNames(config.exporters);
  const updatedExporters = [...currentExporters, ...toAdd];
  // Patch config - only update exporters, preserve everything else
  await patchConfig({ exporters: updatedExporters }, configPath);

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
  if (options.dryRun) {
    return;
  }
  const { loadDetectionCache, saveDetectionCache } = await import(
    "@aligntrue/core"
  );
  const { detectAgentsWithValidation, shouldWarnAboutDetection } = await import(
    "../../utils/detect-agents.js"
  );

  const detection = detectAgentsWithValidation(
    cwd,
    getExporterNames(config.exporters),
  );
  const ignoredSet = new Set(config.detection?.ignored_agents || []);

  detection.missing = detection.missing.filter(
    (agent) => !ignoredSet.has(agent),
  );
  detection.detected = detection.detected.filter(
    (agent) => !ignoredSet.has(agent),
  );
  detection.notFound = detection.notFound.filter(
    (agent) => !ignoredSet.has(agent),
  );
  const cache = loadDetectionCache(cwd);

  if (detection.missing.length === 0) {
    return;
  }

  if (shouldWarnAboutDetection(detection, cache)) {
    const agentsToAdd = detection.missing;

    if (agentsToAdd.length > 0) {
      clack.log.warn(
        `Unconfigured agent files detected: ${agentsToAdd.join(", ")}`,
      );

      let shouldAdd = false;

      if (options.yes || options.nonInteractive) {
        // Auto-accept in non-interactive mode
        shouldAdd = true;
      } else {
        const response = await clack.confirm({
          message: "Add detected agents to exporters?",
          initialValue: true,
        });
        shouldAdd = !clack.isCancel(response) && response;
      }

      if (shouldAdd) {
        // Always use array format for simplicity
        const updatedExporters = [
          ...getExporterNames(config.exporters),
          ...agentsToAdd,
        ];
        // Patch config - only update exporters, preserve everything else
        await patchConfig({ exporters: updatedExporters }, configPath, cwd);
        clack.log.success("Updated exporters in config");
      }
    }

    const isFirstDetection = !cache;
    if (
      detection.notFound.length > 0 &&
      !options.skipNotFoundWarning &&
      !isFirstDetection
    ) {
      clack.log.info(
        `Agent not installed locally: ${detection.notFound.join(", ")}\n` +
          "  (Rules were still exported; install the agent locally to enable previews)",
      );
    }

    // Update cache
    saveDetectionCache(cwd, {
      timestamp: new Date().toISOString(),
      detected: detection.detected,
      configured: getExporterNames(config.exporters),
    });
  }
}
