/**
 * Sync workflow execution - handles unidirectional sync from .aligntrue/rules/ to agents
 */

import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import { BackupManager, getExporterNames } from "@aligntrue/core";
import { clearPromptHandler } from "@aligntrue/plugin-contracts";
import type { SyncContext } from "./context-builder.js";
import type { SyncOptions } from "./options.js";
import { initializePrompts } from "../../utils/prompts.js";
import { stopSpinnerSilently } from "../../utils/spinner.js";

/**
 * Get agent file patterns from configured exporters for backup purposes
 * Returns patterns like ["AGENTS.md", ".cursor/rules/*.mdc", "CLAUDE.md", etc.]
 */
function getAgentFilePatterns(context: SyncContext): string[] {
  const patterns: string[] = [];
  const exporterNames = getExporterNames(context.config.exporters);

  for (const exporterName of exporterNames) {
    const manifest = context.registry.getManifest(exporterName);
    if (manifest?.outputs) {
      patterns.push(...manifest.outputs);
    }
  }

  return patterns;
}

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
 *
 * This is a unidirectional sync: .aligntrue/rules/*.md -> agent-specific formats
 * The .aligntrue/rules/ directory is the single source of truth.
 */
export async function executeSyncWorkflow(
  context: SyncContext,
  options: SyncOptions,
): Promise<SyncResult> {
  const { cwd, config, configPath, engine, spinner } = context;

  // Initialize interactive prompts for conflict resolution if needed
  if (options.verbose || !options.nonInteractive) {
    initializePrompts();
  }

  if (options.verbose) {
    clack.log.info("Verbose mode enabled");
  }

  // Step 1: Mandatory Safety Backup (if not dry-run)
  if (!options.dryRun) {
    if (!options.quiet) {
      spinner.start("Creating safety backup");
    }
    try {
      // Get agent file patterns from configured exporters
      const agentFilePatterns = getAgentFilePatterns(context);

      const backup = BackupManager.createBackup({
        cwd,
        created_by: "sync",
        notes: "Safety backup before sync",
        action: "pre-sync",
        mode: config.mode,
        includeAgentFiles: true,
        agentFilePatterns:
          agentFilePatterns.length > 0 ? agentFilePatterns : null,
      });
      if (!options.quiet) {
        spinner.stop(`Safety backup created: ${backup.timestamp}`);
        if (options.verbose) {
          clack.log.info(
            `Restore with: aligntrue backup restore --timestamp ${backup.timestamp}`,
          );
        }
      }
    } catch (_error) {
      if (!options.quiet) {
        spinner.stop("Backup failed");
        clack.log.warn(
          `Failed to create safety backup: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
        clack.log.warn("Continuing with sync (unsafe)...");
      }
    }
  }

  // Step 2: Execute sync operation (unidirectional: rules -> agents)
  const syncOptions: {
    configPath: string;
    dryRun: boolean;
    force: boolean;
    interactive: boolean;
    defaultResolutionStrategy?: string;
    contentMode?: "auto" | "inline" | "links";
    skipLockfileGeneration?: boolean;
  } = {
    configPath,
    dryRun: options.dryRun || false,
    // --yes flag enables automatic overwriting
    force: options.force || options.yes || false,
    interactive: !options.force && !options.yes && !options.nonInteractive,
    // Skip lockfile generation in SyncEngine since context-builder.ts already handles it
    // with correct fingerprints from bundleResult.align
    skipLockfileGeneration: true,
  };

  // Only set defaultResolutionStrategy if we have a value
  if (options.force || options.yes || options.nonInteractive) {
    syncOptions.defaultResolutionStrategy = "overwrite";
  }

  // Add contentMode if provided via CLI
  if (options.contentMode) {
    syncOptions.contentMode = options.contentMode;
  }

  let result: SyncResult;

  // Execute sync operation: .aligntrue/rules/*.md -> agents
  if (options.verbose) {
    clack.log.info("Exporting rules to all configured agents");
  }

  if (!options.quiet) {
    spinner.start(options.dryRun ? "Previewing changes" : "Syncing to agents");
  }
  result = await engine.syncToAgents(context.absoluteSourcePath, syncOptions);

  if (!options.quiet) {
    // Stop silently without rendering an empty step, let result handler show outro/success message
    stopSpinnerSilently(spinner);
  }

  // Step 3: Remove starter file after first successful sync
  if (!options.dryRun && result.success) {
    const starterPath = join(cwd, ".cursor/rules/aligntrue-starter.mdc");
    const syncedPath = join(cwd, ".cursor/rules/aligntrue.mdc");
    try {
      unlinkSync(starterPath);
      if (existsSync(syncedPath) && !options.quiet) {
        clack.log.info("Removed starter file (replaced by synced rules)");
      }
    } catch {
      // File may not exist or delete failed - not critical
    }
  }

  // Step 4: Auto-cleanup old backups
  if (!options.dryRun) {
    const retentionDays = config.backup?.retention_days ?? 30;
    const minimumKeep = config.backup?.minimum_keep ?? 3;
    try {
      const removed = BackupManager.cleanupOldBackups({
        cwd,
        retentionDays,
        minimumKeep,
      });
      if (removed > 0 && options.verbose) {
        clack.log.info(
          `Cleaned up ${removed} old backup${removed !== 1 ? "s" : ""}`,
        );
      }
    } catch {
      // Silent failure on cleanup - not critical
    }
  }

  // Step 5: Update .gitignore if configured
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

  // Step 6: Apply git integration mode (commit/branch)
  if (
    !options.dryRun &&
    result.success &&
    result.written &&
    result.written.length > 0
  ) {
    const gitMode = config.git?.mode || "ignore";

    if (gitMode === "commit" || gitMode === "branch") {
      try {
        const { GitIntegration } = await import("@aligntrue/core");
        const gitIntegration = new GitIntegration();
        const perExporterOverrides = config.git?.per_exporter;
        const gitResult = await gitIntegration.apply({
          mode: gitMode,
          workspaceRoot: cwd,
          generatedFiles: result.written,
          ...(perExporterOverrides && { perExporterOverrides }),
        });

        if (options.verbose && gitResult.branchCreated) {
          clack.log.info(`Created branch: ${gitResult.branchCreated}`);
        }
        if (options.verbose && gitResult.action) {
          clack.log.info(`Git: ${gitResult.action}`);
        }
      } catch (_error) {
        // Silent failure on git integration - not critical for sync success
        if (options.verbose) {
          clack.log.warn(
            `Git integration failed: ${_error instanceof Error ? _error.message : String(_error)}`,
          );
        }
      }
    }
  }

  // Step 7: Push to remotes if configured and auto-enabled
  if (
    !options.dryRun &&
    result.success &&
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    (config.remotes || config.remote_backup)
  ) {
    try {
      const { createRemotesManager, createRemotesManagerFromLegacy } =
        await import("@aligntrue/core");
      const rulesDir = join(cwd, ".aligntrue", "rules");

      // Use new config if available, otherwise convert legacy
      const remotesManager = config.remotes
        ? createRemotesManager(config.remotes, { cwd, rulesDir })
        : // eslint-disable-next-line @typescript-eslint/no-deprecated
          createRemotesManagerFromLegacy(config.remote_backup!, {
            cwd,
            rulesDir,
          });

      // Only push if auto is enabled
      if (remotesManager.isAutoEnabled()) {
        // Get source URLs for conflict detection
        const sourceUrls =
          config.sources
            ?.filter((s) => s.type === "git" && s.url)
            .map((s) => s.url!)
            .filter(Boolean) ?? [];

        if (!options.quiet) {
          spinner.start("Syncing to remotes");
        }

        const syncResult = await remotesManager.autoSync({
          cwd,
          sourceUrls,
          ...(options.verbose && {
            onProgress: (msg: string) => clack.log.info(msg),
          }),
        });

        if (!options.quiet) {
          if (syncResult.success && syncResult.totalFiles > 0) {
            const destinations = syncResult.results
              .filter(
                (r: { success: boolean; skipped?: boolean }) =>
                  r.success && !r.skipped,
              )
              .map((r: { remoteId: string }) => r.remoteId)
              .join(", ");
            spinner.stop(
              `Synced ${syncResult.totalFiles} files to ${destinations || "remotes"}`,
            );
          } else if (
            syncResult.results.length > 0 &&
            syncResult.results.every((r: { skipped?: boolean }) => r.skipped)
          ) {
            spinner.stop("Remote sync skipped (no changes)");
          } else if (syncResult.results.length === 0) {
            spinner.stop("Remote sync: no files to sync");
          } else {
            spinner.stop("Remote sync completed");
          }
        }

        // Show warnings
        for (const warning of syncResult.warnings) {
          if (!options.quiet) {
            clack.log.warn(warning.message);
          }
        }

        // Show errors
        for (const pushResult of syncResult.results) {
          if (!pushResult.success && pushResult.error) {
            if (!options.quiet) {
              clack.log.error(
                `Failed to sync to ${pushResult.remoteId}: ${pushResult.error}`,
              );
            }
          }
        }
      }
    } catch (_error) {
      // Silent failure on remote backup - not critical for sync success
      if (!options.quiet) {
        stopSpinnerSilently(spinner);
      }
      if (options.verbose) {
        clack.log.warn(
          `Remote backup failed: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
      }
    }
  }

  // Cleanup: Clear prompt handler after sync completes
  clearPromptHandler();

  return result;
}
