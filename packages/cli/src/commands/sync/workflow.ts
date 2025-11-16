/**
 * Sync workflow execution - handles backup, two-way sync, and sync execution
 */

import { existsSync, unlinkSync, writeFileSync } from "fs";
import { join, resolve as resolvePath } from "path";
import * as clack from "@clack/prompts";
import { BackupManager, getAlignTruePaths } from "@aligntrue/core";
import type { SyncContext } from "./context-builder.js";
import type { SyncOptions } from "./options.js";
import { resolveAndMergeSources } from "../../utils/source-resolver.js";

/**
 * Sync result from engine
 */
export interface SyncResult {
  success: boolean;
  written?: string[];
  warnings?: string[];
  conflicts?: Array<{
    heading: string;
    files: Array<{ path: string; mtime: Date }>;
    winner: string;
  }>;
  auditTrail?: Array<{
    action: string;
    target: string;
    details?: string;
    source?: string;
    provenance?: {
      owner?: string;
      source?: string;
      source_sha?: string;
    };
  }>;
}

/**
 * Execute sync workflow
 */
export async function executeSyncWorkflow(
  context: SyncContext,
  options: SyncOptions,
): Promise<SyncResult> {
  const { cwd, config, configPath, engine, spinner } = context;

  if (options.verbose) {
    clack.log.info("Verbose mode enabled");
  }

  // Step 1: Auto-backup (if configured and not dry-run)
  if (!options.dryRun && config.backup?.auto_backup) {
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

  // Step 2: Two-way sync - detect and merge agent file edits
  if (!options.acceptAgent && config.sync?.two_way !== false) {
    if (options.verbose) {
      clack.log.info(
        `Two-way sync enabled (two_way=${String(config.sync?.two_way)})`,
      );
    }
    await handleTwoWaySync(context, options);
    await reapplyPackSources(context, options);
  }

  // Step 3: Execute sync operation
  const syncOptions: {
    configPath: string;
    dryRun: boolean;
    force: boolean;
    interactive: boolean;
    acceptAgent?: string;
    defaultResolutionStrategy?: string;
  } = {
    configPath,
    dryRun: options.dryRun,
    force: options.force,
    interactive: !options.force && !options.yes && !options.nonInteractive,
  };

  // Only set defaultResolutionStrategy if we have a value
  if (options.force || options.yes || options.nonInteractive) {
    syncOptions.defaultResolutionStrategy = "accept_agent";
  }

  if (options.acceptAgent !== undefined) {
    syncOptions.acceptAgent = options.acceptAgent;
  }

  let result: SyncResult;

  // Execute sync operation
  if (options.acceptAgent) {
    // Manual agent → IR sync (pullback)
    spinner.start(
      options.dryRun
        ? "Previewing import"
        : `Importing from ${options.acceptAgent}`,
    );
    result = await engine.syncFromAgent(
      options.acceptAgent,
      context.absoluteSourcePath,
      syncOptions,
    );
  } else {
    // IR → agents sync (default)
    if (options.verbose) {
      clack.log.info("Phase 2: Exporting IR to all configured agents");
    }

    spinner.start(options.dryRun ? "Previewing changes" : "Syncing to agents");
    result = await engine.syncToAgents(context.absoluteSourcePath, syncOptions);
  }

  spinner.stop(options.dryRun ? "Preview complete" : "Sync complete");

  // Step 4: Remove starter file after first successful sync
  if (!options.dryRun && result.success && !options.acceptAgent) {
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

  // Step 5: Auto-cleanup old backups
  if (!options.dryRun && config.backup?.auto_backup) {
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

  // Step 6: Update .gitignore if configured
  if (
    !options.dryRun &&
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
        if (options.verbose) {
          clack.log.warn(
            `Failed to update .gitignore: ${_error instanceof Error ? _error.message : String(_error)}`,
          );
        }
      }
    }
  }

  return result;
}

/**
 * Reapply pack sources after two-way sync to ensure overlays remain.
 */
async function reapplyPackSources(
  context: SyncContext,
  options: SyncOptions,
): Promise<void> {
  const sourceCount = context.config.sources?.length ?? 0;
  const mergedSourceCount = context.bundleResult.sources.length;

  if (options.verbose) {
    clack.log.info(
      `Pack source summary: config=${sourceCount}, merged=${mergedSourceCount}`,
    );
  }

  if (sourceCount <= 1 && mergedSourceCount <= 1) {
    return;
  }

  if (options.verbose) {
    clack.log.info("Reapplying pack sources after agent edits");
  }

  const merged = await resolveAndMergeSources(context.config, {
    cwd: context.cwd,
    offlineMode: options.offline || options.skipUpdateCheck,
    forceRefresh: options.forceRefresh,
    warnConflicts: true,
  });

  const yaml = await import("yaml");
  const bundleYaml = yaml.stringify(merged.pack);
  const paths = getAlignTruePaths(context.cwd);

  const targetPath =
    context.config.sources?.[0]?.type === "local"
      ? resolvePath(context.cwd, context.config.sources[0].path || paths.rules)
      : resolvePath(context.cwd, paths.rules);

  writeFileSync(targetPath, bundleYaml, "utf-8");

  context.bundleResult = merged;
  context.absoluteSourcePath = targetPath;
}

/**
 * Handle two-way sync logic
 */
async function handleTwoWaySync(
  context: SyncContext,
  options: SyncOptions,
): Promise<void> {
  const { cwd, config, configPath, engine, spinner } = context;

  try {
    // Get last sync timestamp for accurate change detection
    const { getLastSyncTimestamp } = await import(
      "@aligntrue/core/sync/last-sync-tracker"
    );
    const lastSyncTime = getLastSyncTimestamp(cwd);
    const lastSyncDate = lastSyncTime ? new Date(lastSyncTime) : undefined;

    // Log detection attempt in verbose mode
    if (options.verbose) {
      clack.log.info(
        `Checking for edits since: ${lastSyncDate?.toISOString() || "never"}`,
      );
    }

    // Dynamic import at runtime
    const multiFileParser = "@aligntrue/core/sync/multi-file-parser";
    // @ts-ignore - Dynamic import resolved at runtime
    const { detectEditedFiles } = await import(multiFileParser);

    // Detect edited agent files with lastSyncDate
    const detectionResult = await detectEditedFiles(cwd, config, lastSyncDate);
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
      if (options.verbose) {
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
        dryRun: options.dryRun,
        force: options.force,
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
      if (options.verbose) {
        clack.log.info("Phase 1: No agent file edits detected since last sync");
        clack.log.info("  → IR is already up to date");
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Check if this is an IR validation error
    const isValidationError = errorMessage.includes("Invalid IR");

    if (isValidationError && !options.forceInvalidIR) {
      // Validation errors should fail the sync unless --force-invalid-ir is used
      clack.log.error(`✗ IR validation failed`);
      clack.log.error(`\n${errorMessage}\n`);
      clack.log.info(
        "To bypass validation (not recommended), use: aligntrue sync --force-invalid-ir",
      );
      process.exit(1);
    }

    // For other errors or when forced, warn and continue
    if (options.forceInvalidIR && isValidationError) {
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
