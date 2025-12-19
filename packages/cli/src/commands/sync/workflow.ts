/**
 * Sync workflow execution - handles unidirectional sync from .aligntrue/rules/ to agents
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import {
  BackupManager,
  computeGitignoreRuleExports,
  getExporterNames,
} from "@aligntrue/core";
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
  lockfilePath?: string;
  overwrittenFiles?: string[];
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

  // Warn when rules target exporters that are not enabled
  const enabledExporters = new Set(getExporterNames(config.exporters));
  const sections = context.bundleResult.align?.sections || [];
  const skippedTargets: Array<{ heading: string; targets: string[] }> = [];

  sections.forEach((section) => {
    const targets =
      section.vendor?.aligntrue?.frontmatter?.export_only_to || [];
    if (targets.length === 0) return;
    const missing = targets.filter((t) => !enabledExporters.has(t));
    if (missing.length === targets.length) {
      const heading =
        section.heading ||
        section.explicitId ||
        section.fingerprint ||
        "Unnamed rule";
      skippedTargets.push({ heading, targets });
    }
  });

  if (!options.quiet && skippedTargets.length > 0) {
    clack.log.warn(
      [
        "Some rules target exporters that are not enabled. They will be skipped:",
        ...skippedTargets.map(
          (item) =>
            `  - ${item.heading} (export_only_to: ${item.targets.join(", ")})`,
        ),
        "Enable the exporter or remove export_only_to to include these rules.",
      ].join("\n"),
    );
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

  // Step 3: Auto-cleanup old backups
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

  // Step 5: Generate lockfile (team mode only, respects dry-run)
  if (
    result.success &&
    config.mode === "team" &&
    config.modules?.lockfile &&
    !options.dryRun
  ) {
    try {
      const { generateLockfile, writeLockfile } =
        await import("@aligntrue/core/lockfile");
      const { loadRulesDirectory, getAlignTruePaths } =
        await import("@aligntrue/core");

      const paths = getAlignTruePaths(cwd);
      const rules = await loadRulesDirectory(paths.rules, cwd);
      const lockfile = generateLockfile(rules, cwd);
      const lockfilePath = join(cwd, ".aligntrue", "lock.json");

      writeLockfile(lockfilePath, lockfile);
      result.lockfilePath = lockfilePath;

      if (options.verbose) {
        clack.log.success(`Lockfile updated: ${lockfilePath}`);
      }
    } catch (lockfileErr) {
      // Log warning but don't fail sync
      if (!options.quiet) {
        clack.log.warn(
          `Failed to update lockfile: ${lockfileErr instanceof Error ? lockfileErr.message : String(lockfileErr)}`,
        );
      }
    }
  }

  // Step 6: Update .gitignore if configured
  if (!options.dryRun && result.success) {
    const gitMode = config.git?.mode || "ignore";
    const autoGitignore = config.git?.auto_gitignore || "auto";

    if (autoGitignore !== "never") {
      try {
        const { GitIntegration } = await import("@aligntrue/core");
        const gitIntegration = new GitIntegration();
        const managedMarker = "# START AlignTrue Generated Files";
        const managedEndMarker = "# END AlignTrue Generated Files";
        const gitignorePath = join(cwd, ".gitignore");

        // If no files were written this run, we still may need to restore the managed block
        const agentFilePatterns = getAgentFilePatterns(context);
        // Always include exporter output patterns to ensure .gitignore covers
        // generated files even if a particular run produced no writes (e.g. no diff)
        const gitignoreRuleExports = computeGitignoreRuleExports(
          context.bundleResult.align?.sections || [],
          getExporterNames(config.exporters),
        );
        const gitignoreExportPaths = new Set(
          gitignoreRuleExports.flatMap((item) => item.exportPaths),
        );

        const writtenForIgnore = (result.written ?? []).filter((filePath) => {
          const normalized = filePath.replace(/\\/g, "/");
          if (gitignoreExportPaths.has(normalized)) return false;
          // Some exporters may return absolute or differently prefixed paths; allow suffix match
          for (const exportPath of gitignoreExportPaths) {
            if (normalized.endsWith(exportPath)) {
              return false;
            }
          }
          return true;
        });

        const filesForIgnore = [
          ...(agentFilePatterns ?? []),
          ...writtenForIgnore,
        ];

        let hasManagedSection = false;
        try {
          const gitignoreContent = readFileSync(gitignorePath, "utf-8");
          hasManagedSection =
            gitignoreContent.includes(managedMarker) &&
            gitignoreContent.includes(managedEndMarker);
        } catch {
          // Missing file counts as missing managed section
          hasManagedSection = false;
        }

        const shouldUpdateGitignore =
          (result.written && result.written.length > 0) ||
          (gitMode === "ignore" &&
            (!hasManagedSection || filesForIgnore.length > 0));

        if (shouldUpdateGitignore) {
          await gitIntegration.updateGitignore(
            cwd,
            filesForIgnore,
            autoGitignore,
            gitMode,
          );

          // Also add per-rule gitignore exports
          if (gitignoreRuleExports.length > 0) {
            await gitIntegration.addGitignoreRuleExportsToGitignore(
              cwd,
              gitignoreRuleExports,
            );
          }
        }
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

  // Step 7: Apply git integration mode (commit/branch)
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
        // Stage exports and lockfile together so drift checks don't fail on partial commits
        const filesToStage = [...result.written];
        const lockfilePath = join(cwd, ".aligntrue", "lock.json");
        if (existsSync(lockfilePath)) {
          filesToStage.push(".aligntrue/lock.json");
        }

        const gitResult = await gitIntegration.apply({
          mode: gitMode,
          workspaceRoot: cwd,
          generatedFiles: filesToStage,
          ...(perExporterOverrides && { perExporterOverrides }),
        });

        // Log branch/commit mode results at info level (not just verbose)
        // since users explicitly configured this mode
        if (gitResult.branchCreated && !options.quiet) {
          clack.log.info(`Created branch: ${gitResult.branchCreated}`);
        }
        if (gitResult.action && !options.quiet) {
          clack.log.info(`Git: ${gitResult.action}`);
        }
      } catch (_error) {
        // Log failures for explicitly configured git modes (not silent)
        // This helps users understand why their configured git mode didn't work
        if (!options.quiet) {
          clack.log.warn(
            `Git integration failed: ${_error instanceof Error ? _error.message : String(_error)}`,
          );
        }
      }
    }
  }

  // Step 8: Push to remotes if configured and auto-enabled
  if (!options.dryRun && result.success && config.remotes) {
    try {
      const { createRemotesManager } = await import("@aligntrue/core");
      const rulesDir = join(cwd, ".aligntrue", "rules");

      // Pass mode to enable mode-aware routing (solo pushes all, team uses scope)
      const remotesManager = createRemotesManager(config.remotes, {
        cwd,
        rulesDir,
        mode: config.mode || "solo",
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
            // Show actionable diagnostics when no files sync
            spinner.stop("Remote sync: no files matched routing rules");

            // Display diagnostics to help user understand why
            if (syncResult.diagnostics) {
              const { mode, totalFiles, unroutedFiles } =
                syncResult.diagnostics;
              clack.log.info(
                `Found ${totalFiles} rule files, 0 routed to remotes`,
              );

              if (mode === "team") {
                clack.log.info(
                  `Team mode uses scope-based routing. Add 'scope: personal' to rule frontmatter.`,
                );
              } else if (totalFiles > 0) {
                clack.log.info(
                  `Check that remotes.personal is configured in .aligntrue/config.yaml`,
                );
              }

              // Show sample unrouted files (up to 5)
              if (unroutedFiles.length > 0 && unroutedFiles.length <= 5) {
                for (const { path, scope, reason } of unroutedFiles) {
                  clack.log.step(`  ${path} (${scope}: ${reason})`);
                }
              } else if (unroutedFiles.length > 5) {
                for (const { path, scope, reason } of unroutedFiles.slice(
                  0,
                  3,
                )) {
                  clack.log.step(`  ${path} (${scope}: ${reason})`);
                }
                clack.log.step(`  ... and ${unroutedFiles.length - 3} more`);
              }
            }
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
      // Silent failure on remotes push - not critical for sync success
      if (!options.quiet) {
        stopSpinnerSilently(spinner);
      }
      if (options.verbose) {
        clack.log.warn(
          `Remote push failed: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
      }
    }
  }

  // Cleanup: Clear prompt handler after sync completes
  clearPromptHandler();

  return result;
}
