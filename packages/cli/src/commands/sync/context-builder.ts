/**
 * Sync context builder - loads config, sources, exporters, and detects agents
 */

import { existsSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
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
import { detectNewAgents } from "../../utils/detect-agents.js";
import { resolveAndMergeSources } from "../../utils/source-resolver.js";
import { UpdatesAvailableError } from "@aligntrue/sources";
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
  const spinner = createSpinner();
  spinner.start("Loading configuration");

  const config: AlignTrueConfig = await loadConfigWithValidation(configPath);
  spinner.stop("Configuration loaded");

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
  spinner.start("Resolving sources");

  let sourcePath: string;
  let absoluteSourcePath: string;
  let bundleResult: Awaited<ReturnType<typeof resolveAndMergeSources>>;

  try {
    bundleResult = await resolveAndMergeSources(config, {
      cwd,
      offlineMode: options.offline || options.skipUpdateCheck,
      forceRefresh: options.forceRefresh,
      warnConflicts: true,
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

  // Step 4: Detect new agents (unless --no-detect or --dry-run)
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
  spinner.start("Loading exporters");

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
    const exporterNames = config.exporters || ["cursor", "agents-md"];
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

    spinner.stop(
      `Loaded ${loadedCount} exporter${loadedCount !== 1 ? "s" : ""}`,
    );

    if (loadedCount > 0) {
      const names = exporterNames.slice(0, loadedCount).join(", ");
      clack.log.success(`Active: ${names}`);
    }
  } catch (_error) {
    spinner.stop("Exporter loading failed");
    throw ErrorFactory.syncFailed(
      `Failed to load exporters: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
  }

  // Step 8: Validate rules
  spinner.start("Validating rules");

  try {
    const sections = bundleResult.pack.sections || [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;
      // Section validation happens at parse time
    }
    spinner.stop("Rules validated");
  } catch (_error) {
    spinner.stop("Validation failed");
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
 */
async function detectAndEnableAgents(
  config: AlignTrueConfig,
  configPath: string,
  options: SyncOptions,
): Promise<void> {
  const cwd = process.cwd();
  const newAgents = detectNewAgents(
    cwd,
    config.exporters || [],
    config.detection?.ignored_agents || [],
  );

  if (newAgents.length === 0) return;

  const shouldAutoEnable = options.autoEnable || config.detection?.auto_enable;

  if (shouldAutoEnable) {
    // Auto-enable without prompting
    clack.log.info(`Auto-enabling ${newAgents.length} detected agent(s)...`);
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
