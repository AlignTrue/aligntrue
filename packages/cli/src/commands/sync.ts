/**
 * Sync command - Sync rules to agents
 * Orchestrates loading config, pulling sources, and syncing IR to/from agents
 */

import { existsSync } from "fs";
import { resolve } from "path";
import * as clack from "@clack/prompts";
import {
  SyncEngine,
  type AlignTrueConfig,
  getAlignTruePaths,
  BackupManager,
} from "@aligntrue/core";
import { ExporterRegistry } from "@aligntrue/exporters";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { canonicalizeJson } from "@aligntrue/schema";
import { createHash } from "node:crypto";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

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
    flag: "--force",
    hasValue: false,
    description: "Bypass allow list validation in team mode (use with caution)",
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
        "  Loads rules from .aligntrue/rules.md (or configured source), resolves scopes,",
        "  and syncs to configured agent exporters (Cursor, AGENTS.md, VS Code MCP, etc.).",
        "",
        "  In team mode with lockfile enabled, validates lockfile before syncing.",
        "",
        "  Default direction: IR → agents (rules.md to agent config files)",
        "  Pullback direction: agents → IR (with --accept-agent flag)",
      ],
    });
    process.exit(0);
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

    // Check if allow list exists first
    if (!existsSync(allowListPath)) {
      clack.log.info("ℹ No allow list found (team mode)");
      clack.log.info("  Sources will be validated once allow list is created");
      clack.log.info("  Run: aligntrue team approve <source>");
    } else {
      try {
        const { parseAllowList, isSourceAllowed } = await import(
          "@aligntrue/core/team/allow.js"
        );
        const allowList = parseAllowList(allowListPath);

        // Validate each source in config
        const unapprovedSources: string[] = [];

        if (config.sources) {
          for (const source of config.sources) {
            // For now, just check path-based sources
            // TODO Phase 3.5: Check git/catalog sources once implemented
            if (source.path && source.path !== paths.rules) {
              // External source path - would need approval if pulling from git/catalog
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
      } catch (err) {
        // Parsing error - log but don't fail
        clack.log.warn(
          `⚠ Failed to validate allow list: ${err instanceof Error ? err.message : String(err)}`,
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

  // Step 4: Auto-pull logic (solo mode)
  let shouldAutoPull = false;
  let autoPullAgent: string | undefined;
  const acceptAgent = parsed.flags["accept-agent"] as string | undefined;
  const dryRun = (parsed.flags["dry-run"] as boolean | undefined) || false;

  if (config.sync?.auto_pull && !acceptAgent) {
    // Auto-pull enabled and user didn't manually specify agent
    autoPullAgent = config.sync.primary_agent;

    if (autoPullAgent) {
      // Check if primary agent's file exists
      const { canImportFromAgent, getImportSourcePath } = await import(
        "@aligntrue/core"
      );

      if (canImportFromAgent(autoPullAgent)) {
        const agentSourcePath = getImportSourcePath(autoPullAgent, cwd);

        if (existsSync(agentSourcePath)) {
          shouldAutoPull = true;
          clack.log.info(`Auto-pull enabled: pulling from ${autoPullAgent}`);
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
  } catch (error) {
    spinner.stop("Exporter loading failed");
    exitWithError(
      Errors.syncFailed(
        `Failed to load exporters: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  // Step 5.5: Load and validate rule IDs in IR
  spinner.start("Validating rules");

  try {
    const { loadIR } = await import("@aligntrue/core");
    const { validateRuleId } = await import("@aligntrue/schema");
    const ir = await loadIR(absoluteSourcePath);

    // Validate all rule IDs
    for (const rule of ir.rules || []) {
      const validation = validateRuleId(rule.id);
      if (!validation.valid) {
        spinner.stop("Validation failed");
        const details = [
          `Invalid rule ID: ${rule.id}`,
          `Error: ${validation.error}`,
        ];
        if (validation.suggestion) {
          details.push(`Suggestion: ${validation.suggestion}`);
        }
        exitWithError(Errors.validationFailed(details), 2);
      }
    }

    spinner.stop("Rules validated");
  } catch (error) {
    spinner.stop("Validation failed");
    exitWithError(
      Errors.syncFailed(
        `Failed to load or validate rules: ${error instanceof Error ? error.message : String(error)}`,
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
      } catch (error) {
        spinner.stop("Backup failed");
        clack.log.warn(
          `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
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

      const pullResult = await engine.syncFromAgent(
        autoPullAgent,
        absoluteSourcePath,
        {
          ...syncOptions,
          interactive: false, // Auto-pull is non-interactive
          defaultResolutionStrategy: config.sync?.on_conflict || "accept_agent",
        },
      );

      spinner.stop(`Auto-pull complete from ${autoPullAgent}`);

      if (!pullResult.success) {
        clack.log.warn(
          `Auto-pull failed: ${pullResult.warnings?.[0] || "Unknown error"}`,
        );
      } else if (pullResult.written && pullResult.written.length > 0) {
        clack.log.success(`Updated IR from ${autoPullAgent}`);
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

    // Step 8: Auto-cleanup old backups (if configured and not dry-run)
    if (!dryRun && config.backup?.auto_backup) {
      const keepCount = config.backup.keep_count ?? 10;
      try {
        const removed = BackupManager.cleanupOldBackups({ cwd, keepCount });
        if (removed > 0) {
          clack.log.info(
            `Cleaned up ${removed} old backup${removed !== 1 ? "s" : ""}`,
          );
        }
      } catch (error) {
        // Silent failure on cleanup - not critical
      }
    }

    // Step 9: Display results
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
        result.warnings.forEach((warning) => {
          clack.log.warn(warning);
        });
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
      } catch (telemetryError) {
        // Telemetry errors should not fail the sync command
        // Silently continue
      }

      clack.outro(dryRun ? "✓ Preview complete" : "✓ Sync complete");
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
