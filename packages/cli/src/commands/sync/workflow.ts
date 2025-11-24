/**
 * Sync workflow execution - handles backup, two-way sync, and sync execution
 */

import { existsSync, unlinkSync } from "fs";
import { join, resolve as resolvePath } from "path";
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
        editSource: config.sync?.edit_source || null,
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

  // Step 2: Two-way sync (REMOVED - see edit_source migration)
  // Edit source detection and merging now happens in handleAgentDetectionAndOnboarding (Step 4 of context builder)

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
    dryRun: options.dryRun || false,
    // --yes flag enables automatic overwriting of read-only file edits
    force: options.force || options.yes || false,
    interactive: !options.force && !options.yes && !options.nonInteractive,
  };

  // Only set defaultResolutionStrategy if we have a value
  if (options.force || options.yes || options.nonInteractive) {
    syncOptions.defaultResolutionStrategy = "accept_agent";
  }

  // Normalize acceptAgent format (accept both "agents" and "agents-md")
  let normalizedAcceptAgent: string | undefined;
  if (options.acceptAgent !== undefined) {
    // Map format IDs to exporter names
    // "agents-md" is the format ID, "agents" is the exporter name
    if (options.acceptAgent === "agents-md") {
      normalizedAcceptAgent = "agents";
    } else {
      normalizedAcceptAgent = options.acceptAgent;
    }
    if (normalizedAcceptAgent !== undefined) {
      syncOptions.acceptAgent = normalizedAcceptAgent;
    }
  }

  let result: SyncResult;

  // Execute sync operation
  if (normalizedAcceptAgent) {
    // Manual agent → IR sync (pullback)
    if (!options.quiet) {
      spinner.start(
        options.dryRun
          ? "Previewing import"
          : `Importing from ${normalizedAcceptAgent}`,
      );
      spinnerActive = true;
    }
    result = await engine.syncFromAgent(
      normalizedAcceptAgent,
      context.absoluteSourcePath,
      syncOptions,
    );
  } else {
    // IR → agents sync (default)
    if (options.verbose) {
      clack.log.info("Phase 2: Exporting IR to all configured agents");
    }

    if (!options.quiet) {
      spinner.start(
        options.dryRun ? "Previewing changes" : "Syncing to agents",
      );
      spinnerActive = true;
    }
    result = await engine.syncToAgents(context.absoluteSourcePath, syncOptions);
  }

  if (!options.quiet) {
    // Stop without message, let result handler show outro/success message
    stopSpinner();
  } else {
    stopSpinner(); // Silent stop if spinner was never started
  }

  // Step 4: Remove starter file after first successful sync
  if (!options.dryRun && result.success && !normalizedAcceptAgent) {
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

  // Step 5: Auto-cleanup old backups
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

  // Step 7: Check edit source file sizes and provide hints
  if (result.success && !options.dryRun) {
    try {
      const { analyzeFiles, formatFileSizeWarnings } = await import(
        "../../utils/file-size-detector.js"
      );

      // Get edit source files to analyze
      const editSource = config.sync?.edit_source;
      const filesToAnalyze: Array<{ path: string; relativePath: string }> = [];

      if (editSource) {
        const patterns = Array.isArray(editSource) ? editSource : [editSource];

        for (const pattern of patterns) {
          // Skip special patterns
          if (
            pattern === ".rules.yaml" ||
            pattern === "any_agent_file" ||
            pattern.includes("*")
          ) {
            continue;
          }

          // Check if file exists and add to analysis
          const fullPath = resolvePath(cwd, pattern);
          if (existsSync(fullPath)) {
            filesToAnalyze.push({
              path: fullPath,
              relativePath: pattern,
            });
          }
        }
      }

      // Analyze files if we have any
      if (filesToAnalyze.length > 0) {
        const analyses = analyzeFiles(filesToAnalyze);
        const warnings = formatFileSizeWarnings(analyses);

        if (warnings) {
          console.log(warnings);
        }
      }
    } catch (_error) {
      // Silent failure on file size analysis - not critical
      if (options.verbose) {
        clack.log.warn(
          `Failed to analyze file sizes: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
      }
    }
  }

  // Cleanup: Clear prompt handler after sync completes
  clearPromptHandler();

  return result;
}
