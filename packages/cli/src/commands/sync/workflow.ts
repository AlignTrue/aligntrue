/**
 * Sync workflow execution - handles unidirectional sync from .aligntrue/rules/ to agents
 */

import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import { BackupManager } from "@aligntrue/core";
import { clearPromptHandler } from "@aligntrue/plugin-contracts";
import type { SyncContext } from "./context-builder.js";
import type { SyncOptions } from "./options.js";
import { initializePrompts } from "../../utils/prompts.js";

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

  // Track spinner state to prevent double-stops and stuck animations
  let spinnerActive = false;
  const stopSpinner = (message?: string): void => {
    if (spinnerActive) {
      spinner.stop(message);
      spinnerActive = false;
    }
  };

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
      spinnerActive = true;
    }
    try {
      const backup = BackupManager.createBackup({
        cwd,
        created_by: "sync",
        notes: "Safety backup before sync",
        action: "pre-sync",
        mode: config.mode,
        includeAgentFiles: true,
        editSource: null, // No longer using edit source
      });
      if (!options.quiet) {
        stopSpinner(`Safety backup created: ${backup.timestamp}`);
        if (options.verbose) {
          clack.log.info(
            `Restore with: aligntrue backup restore --to ${backup.timestamp}`,
          );
        }
      }
    } catch (_error) {
      if (!options.quiet) {
        stopSpinner("Backup failed");
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
  } = {
    configPath,
    dryRun: options.dryRun || false,
    // --yes flag enables automatic overwriting
    force: options.force || options.yes || false,
    interactive: !options.force && !options.yes && !options.nonInteractive,
  };

  // Only set defaultResolutionStrategy if we have a value
  if (options.force || options.yes || options.nonInteractive) {
    syncOptions.defaultResolutionStrategy = "overwrite";
  }

  let result: SyncResult;

  // Execute sync operation: .aligntrue/rules/*.md -> agents
  if (options.verbose) {
    clack.log.info("Exporting rules to all configured agents");
  }

  if (!options.quiet) {
    spinner.start(options.dryRun ? "Previewing changes" : "Syncing to agents");
    spinnerActive = true;
  }
  result = await engine.syncToAgents(context.absoluteSourcePath, syncOptions);

  if (!options.quiet) {
    // Stop without message, let result handler show outro/success message
    stopSpinner();
  } else {
    stopSpinner(); // Silent stop if spinner was never started
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
    const keepCount = config.backup?.keep_count || 20;
    try {
      const removed = BackupManager.cleanupOldBackups({ cwd, keepCount });
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

  // Cleanup: Clear prompt handler after sync completes
  clearPromptHandler();

  return result;
}
