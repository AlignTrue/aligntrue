/**
 * Sync workflow execution - handles backup, two-way sync, and sync execution
 */

import { existsSync, unlinkSync, writeFileSync } from "fs";
import { join, resolve as resolvePath } from "path";
import * as clack from "@clack/prompts";
import { BackupManager, getAlignTruePaths } from "@aligntrue/core";
import { clearPromptHandler } from "@aligntrue/plugin-contracts";
import type { SyncContext } from "./context-builder.js";
import type { SyncOptions } from "./options.js";
import { resolveAndMergeSources } from "../../utils/source-resolver.js";
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

  // Step 2: Two-way sync - detect and merge agent file edits
  if (
    !options.acceptAgent &&
    !options.skipTwoWayDetection &&
    config.sync?.two_way !== false
  ) {
    if (!options.quiet && options.verbose) {
      clack.log.info(
        `Two-way sync enabled (two_way=${String(config.sync?.two_way)})`,
      );
    }

    // We pass spinner control functions to handleTwoWaySync but it manages its own spinner lifecycle
    // Ideally we should refactor it to use the passed control functions, but for now
    // we'll just let it be since it's a separate function scope.
    // However, we need to make sure it doesn't conflict with our spinnerActive state.
    // Since it's awaited, it should be fine as long as we don't have an active spinner when calling it.
    if (spinnerActive) {
      stopSpinner();
    }

    // We need to pass the spinner tracking mechanism to handleTwoWaySync or reimplement it there.
    // For now, let's wrap the spinner calls in handleTwoWaySync to use our tracking if possible,
    // or just ensure we are clean before calling it.
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
    syncOptions.acceptAgent = normalizedAcceptAgent;
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
 * Handle two-way sync - merge edits from edit_source files into IR
 * Works in both centralized (default) and decentralized modes
 * In centralized mode: only reads from edit_source files
 * In decentralized mode: reads from any agent file
 */
async function handleTwoWaySync(
  context: SyncContext,
  options: SyncOptions,
): Promise<void> {
  const { cwd, config, configPath, engine, spinner } = context;

  // Note: In centralized mode, detectEditedFiles only returns files matching edit_source
  // In decentralized mode (centralized: false), it can return files from any agent
  // So we can run this in both modes - the filtering happens in detectEditedFiles

  // Local spinner tracking for this function since it might be called independently
  let spinnerActive = false;
  const stopSpinner = (message?: string): void => {
    if (spinnerActive) {
      spinner.stop(message);
      spinnerActive = false;
    }
  };

  try {
    // Get last sync timestamp for accurate change detection
    const { getLastSyncTimestamp } = await import(
      "@aligntrue/core/sync/last-sync-tracker"
    );
    const lastSyncTime = getLastSyncTimestamp(cwd);
    const lastSyncDate = lastSyncTime ? new Date(lastSyncTime) : undefined;

    // Log detection attempt in verbose mode (if not quiet)
    if (!options.quiet && options.verbose) {
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
      if (!options.quiet && options.verbose) {
        clack.log.info("Phase 1: Merging agent file edits into IR");
      }

      if (!options.quiet) {
        spinner.start("Merging changes from edited files");
        spinnerActive = true;
      }

      if (!options.quiet && options.verbose) {
        clack.log.info(
          `Detected ${editedFiles.length} edited file${editedFiles.length !== 1 ? "s" : ""}:`,
        );
        editedFiles.forEach((f: { path: string; sections: unknown[] }) => {
          clack.log.info(`  - ${f.path}: ${f.sections.length} section(s)`);
        });
      }

      // Run two-way sync via engine
      const twoWayResult = await engine.syncFromMultipleAgents(configPath, {
        dryRun: options.dryRun,
        force: options.force,
      });

      if (!options.quiet) {
        stopSpinner("Changes merged");

        if (twoWayResult.warnings && twoWayResult.warnings.length > 0) {
          twoWayResult.warnings.forEach((warning) => {
            clack.log.warn(`⚠ ${warning}`);
          });
        }

        if (options.verbose) {
          clack.log.success("Merged changes from agent files to IR");
        }
      }
    } else {
      // No edits detected - this is normal when IR is the source of truth
      if (!options.quiet && options.verbose) {
        clack.log.info("Phase 1: No agent file edits detected since last sync");
        clack.log.info("  → IR is already up to date");
      }
    }
  } catch (err) {
    stopSpinner(); // Ensure spinner is stopped on error

    const errorMessage = err instanceof Error ? err.message : String(err);

    // Check if this is an IR validation error
    const isValidationError = errorMessage.includes("Invalid IR");

    if (isValidationError && !options.forceInvalidIR) {
      // Validation errors should fail the sync unless --force-invalid-ir is used
      clack.log.error(`✗ IR validation failed`);
      clack.log.error(`\n${errorMessage}\n`);
      clack.log.info(
        "Note: .aligntrue/.rules.yaml is auto-generated. Edit AGENTS.md or agent files instead.",
      );
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
