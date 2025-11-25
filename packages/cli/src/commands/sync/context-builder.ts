/**
 * Sync context builder - loads config, sources, exporters, and detects agents
 */

import { existsSync, writeFileSync, statSync } from "fs";
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
import { ExporterRegistry } from "@aligntrue/exporters";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import { loadConfigWithValidation } from "../../utils/config-loader.js";
import { AlignTrueError, ErrorFactory } from "../../utils/error-types.js";

import { resolveAndMergeSources } from "../../utils/source-resolver.js";

// Helper functions (replaced edit-source utilities)
function _getExporterFromEditSource(
  _source: string | string[] | undefined,
): string | undefined {
  return undefined; // No longer used with unidirectional sync
}

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

function _categorizeDetectedAgents(
  _detected: Array<{ agent: string; detected: boolean }>,
  _currentAgent: string | undefined,
  _exporters: string[],
): { upgradeCandidates: string[]; exportTargets: string[] } {
  return { upgradeCandidates: [], exportTargets: [] };
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
import { createSpinner, SpinnerLike } from "../../utils/spinner.js";
import type { SyncOptions } from "./options.js";
import { getInvalidExporters } from "../../utils/exporter-validation.js";

// Get the exporters package directory for adapter discovery
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
        : bundleResult.sources[0]?.sourcePath || ".aligntrue/rules";

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
  if (!options.dryRun) {
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

  // Step 9: Write merged bundle to local IR (only for file-based sources)
  // Skip for directory-based sources (new rule file format)
  if (bundleResult.sources.length > 0) {
    // For git sources, use a temporary bundle file instead of .aligntrue/rules
    // to preserve the git source as the canonical source
    const isGitSource = config.sources?.[0]?.type === "git";
    let targetPath: string;

    if (isGitSource) {
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

    // Write merged bundle to file (skip if target is a directory - new format)
    // Uses EAFP pattern to avoid TOCTOU race condition
    try {
      const yaml = await import("yaml");
      const bundleYaml = yaml.stringify(bundleResult.pack);
      writeFileSync(targetPath, bundleYaml, "utf-8");
      absoluteSourcePath = targetPath;
    } catch (err) {
      // EISDIR means target is a directory (new format - rules already in place)
      // This is expected and OK - skip writing, rules are already in place
      const isDirectoryError =
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "EISDIR";
      if (!isDirectoryError) {
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

  if (lockfilePath) {
    context.lockfilePath = lockfilePath;
    context.lockfileWritten = lockfileWritten;
  }

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
        config.exporters = [...(config.exporters || []), ...detection.missing];
        await saveMinimalConfig(config, configPath, cwd);
        clack.log.success("Updated exporters in config");
      }
    }

    if (detection.notFound.length > 0 && !options.skipNotFoundWarning) {
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
