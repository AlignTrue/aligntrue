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
  error?: string;
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

type SyncState = Omit<SyncResult, "success"> & {
  written: string[];
  warnings: string[];
};

type StepResult =
  | { ok: true; state: SyncState }
  | { ok: false; state: SyncState; error?: string };

type SyncStep = (
  context: SyncContext,
  options: SyncOptions,
  state: SyncState,
) => Promise<StepResult>;

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
  const { config } = context;

  if (options.verbose || !options.nonInteractive) {
    initializePrompts();
  }

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

  const steps: Array<[string, SyncStep]> = [
    ["createSafetyBackup", createSafetyBackupStep],
    ["executeSync", executeSyncStep],
    ["cleanupBackups", cleanupBackupsStep],
    ["generateLockfile", generateLockfileStep],
    ["updateGitignore", updateGitignoreStep],
    ["applyGitMode", applyGitModeStep],
    ["syncToRemotes", syncToRemotesStep],
  ];

  let state: SyncState = { written: [], warnings: [] };

  try {
    for (const [, stepFn] of steps) {
      const result = await stepFn(context, options, state);
      state = result.state;
      if (!result.ok) {
        return {
          success: false,
          ...state,
          warnings: state.warnings,
          ...(result.error ? { error: result.error } : {}),
        } as SyncResult;
      }
    }

    return { success: true, ...state };
  } finally {
    clearPromptHandler();
  }
}

function appendWarning(state: SyncState, warning: string): SyncState {
  return { ...state, warnings: [...state.warnings, warning] };
}

const createSafetyBackupStep: SyncStep = async (context, options, state) => {
  const { config, cwd, spinner } = context;
  if (options.dryRun) return { ok: true, state };

  if (!options.quiet) {
    spinner.start("Creating safety backup");
  }
  try {
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
    return { ok: true, state };
  } catch (_error) {
    const warning = `Failed to create safety backup: ${_error instanceof Error ? _error.message : String(_error)}`;
    if (!options.quiet) {
      spinner.stop("Backup failed");
      clack.log.warn(warning);
      clack.log.warn("Continuing with sync (unsafe)...");
    }
    return { ok: true, state: appendWarning(state, warning) };
  }
};

const executeSyncStep: SyncStep = async (context, options, state) => {
  const { configPath, engine, spinner } = context;

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
    force: options.force || options.yes || false,
    interactive: !options.force && !options.yes && !options.nonInteractive,
    skipLockfileGeneration: true,
  };

  if (options.force || options.yes || options.nonInteractive) {
    syncOptions.defaultResolutionStrategy = "overwrite";
  }

  if (options.contentMode) {
    syncOptions.contentMode = options.contentMode;
  }

  if (options.verbose) {
    clack.log.info("Exporting rules to all configured agents");
  }

  if (!options.quiet) {
    spinner.start(options.dryRun ? "Previewing changes" : "Syncing to agents");
  }

  const engineResult = await engine.syncToAgents(
    context.absoluteSourcePath,
    syncOptions,
  );

  if (!options.quiet) {
    stopSpinnerSilently(spinner);
  }

  const mergedWarnings = [...state.warnings, ...(engineResult.warnings ?? [])];

  if (!engineResult.success) {
    return {
      ok: false,
      state: {
        ...state,
        warnings: mergedWarnings,
        written: engineResult.written ?? state.written,
      },
      error:
        engineResult.warnings?.at(0) ??
        "Sync engine reported failure. See warnings.",
    };
  }

  const nextState: SyncState = {
    ...state,
    warnings: mergedWarnings,
    written: engineResult.written ?? [],
    ...((engineResult.lockfilePath || state.lockfilePath) !== undefined
      ? { lockfilePath: engineResult.lockfilePath ?? state.lockfilePath }
      : {}),
    ...(engineResult.overwrittenFiles !== undefined
      ? { overwrittenFiles: engineResult.overwrittenFiles }
      : {}),
    ...(engineResult.conflicts !== undefined
      ? { conflicts: engineResult.conflicts }
      : {}),
    ...(engineResult.auditTrail !== undefined
      ? { auditTrail: engineResult.auditTrail }
      : {}),
    ...(engineResult.exportResults !== undefined
      ? { exportResults: engineResult.exportResults }
      : {}),
  };

  return { ok: true, state: nextState };
};

const cleanupBackupsStep: SyncStep = async (context, options, state) => {
  const { config, cwd } = context;
  if (options.dryRun) return { ok: true, state };

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
  return { ok: true, state };
};

const generateLockfileStep: SyncStep = async (context, options, state) => {
  const { config, cwd } = context;
  if (options.dryRun) return { ok: true, state };
  if (!(config.mode === "team" && config.modules?.lockfile)) {
    return { ok: true, state };
  }

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

    if (options.verbose) {
      clack.log.success(`Lockfile updated: ${lockfilePath}`);
    }

    return { ok: true, state: { ...state, lockfilePath } };
  } catch (lockfileErr) {
    const warning = `Failed to update lockfile: ${lockfileErr instanceof Error ? lockfileErr.message : String(lockfileErr)}`;
    if (!options.quiet) {
      clack.log.warn(warning);
    }
    return { ok: true, state: appendWarning(state, warning) };
  }
};

const updateGitignoreStep: SyncStep = async (context, options, state) => {
  const { config, cwd } = context;
  if (options.dryRun) {
    return { ok: true, state };
  }

  const gitMode = config.git?.mode || "ignore";
  const autoGitignore = config.git?.auto_gitignore || "auto";

  if (autoGitignore === "never") {
    return { ok: true, state };
  }

  try {
    const { GitIntegration } = await import("@aligntrue/core");
    const gitIntegration = new GitIntegration();
    const managedMarker = "# START AlignTrue Generated Files";
    const managedEndMarker = "# END AlignTrue Generated Files";
    const gitignorePath = join(cwd, ".gitignore");

    const agentFilePatterns = getAgentFilePatterns(context);
    const gitignoreRuleExports = computeGitignoreRuleExports(
      context.bundleResult.align?.sections || [],
      getExporterNames(config.exporters),
    );
    const gitignoreExportPaths = new Set(
      gitignoreRuleExports.flatMap((item) => item.exportPaths),
    );

    const writtenForIgnore = (state.written ?? []).filter((filePath) => {
      const normalized = filePath.replace(/\\/g, "/");
      if (gitignoreExportPaths.has(normalized)) return false;
      for (const exportPath of gitignoreExportPaths) {
        if (normalized.endsWith(exportPath)) {
          return false;
        }
      }
      return true;
    });

    const filesForIgnore = [...(agentFilePatterns ?? []), ...writtenForIgnore];

    let hasManagedSection = false;
    try {
      const gitignoreContent = readFileSync(gitignorePath, "utf-8");
      hasManagedSection =
        gitignoreContent.includes(managedMarker) &&
        gitignoreContent.includes(managedEndMarker);
    } catch {
      hasManagedSection = false;
    }

    const shouldUpdateGitignore =
      (state.written && state.written.length > 0) ||
      (gitMode === "ignore" &&
        (!hasManagedSection || filesForIgnore.length > 0));

    if (shouldUpdateGitignore) {
      await gitIntegration.updateGitignore(
        cwd,
        filesForIgnore,
        autoGitignore,
        gitMode,
      );

      if (gitignoreRuleExports.length > 0) {
        await gitIntegration.addGitignoreRuleExportsToGitignore(
          cwd,
          gitignoreRuleExports,
        );
      }
    }
    return { ok: true, state };
  } catch (_error) {
    if (options.verbose) {
      clack.log.warn(
        `Failed to update .gitignore: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
    return { ok: true, state };
  }
};

const applyGitModeStep: SyncStep = async (context, options, state) => {
  const { config, cwd } = context;
  if (options.dryRun || state.written.length === 0) {
    return { ok: true, state };
  }

  const gitMode = config.git?.mode || "ignore";

  if (gitMode !== "commit" && gitMode !== "branch") {
    return { ok: true, state };
  }

  try {
    const { GitIntegration } = await import("@aligntrue/core");
    const gitIntegration = new GitIntegration();
    const perExporterOverrides = config.git?.per_exporter;
    const filesToStage = [...state.written];
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

    if (gitResult.branchCreated && !options.quiet) {
      clack.log.info(`Created branch: ${gitResult.branchCreated}`);
    }
    if (gitResult.action && !options.quiet) {
      clack.log.info(`Git: ${gitResult.action}`);
    }
    return { ok: true, state };
  } catch (_error) {
    if (!options.quiet) {
      clack.log.warn(
        `Git integration failed: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
    return { ok: true, state };
  }
};

const syncToRemotesStep: SyncStep = async (context, options, state) => {
  const { config, cwd, spinner } = context;
  if (options.dryRun || !config.remotes) {
    return { ok: true, state };
  }

  try {
    const { createRemotesManager } = await import("@aligntrue/core");
    const rulesDir = join(cwd, ".aligntrue", "rules");

    const remotesManager = createRemotesManager(config.remotes, {
      cwd,
      rulesDir,
      mode: config.mode || "solo",
    });

    if (!remotesManager.isAutoEnabled()) {
      return { ok: true, state };
    }

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
        spinner.stop("Remote sync: no files matched routing rules");

        if (syncResult.diagnostics) {
          const { mode, totalFiles, unroutedFiles } = syncResult.diagnostics;
          clack.log.info(`Found ${totalFiles} rule files, 0 routed to remotes`);

          if (mode === "team") {
            clack.log.info(
              `Team mode uses scope-based routing. Add 'scope: personal' to rule frontmatter.`,
            );
          } else if (totalFiles > 0) {
            clack.log.info(
              `Check that remotes.personal is configured in .aligntrue/config.yaml`,
            );
          }

          if (unroutedFiles.length > 0 && unroutedFiles.length <= 5) {
            for (const { path, scope, reason } of unroutedFiles) {
              clack.log.step(`  ${path} (${scope}: ${reason})`);
            }
          } else if (unroutedFiles.length > 5) {
            for (const { path, scope, reason } of unroutedFiles.slice(0, 3)) {
              clack.log.step(`  ${path} (${scope}: ${reason})`);
            }
            clack.log.step(`  ... and ${unroutedFiles.length - 3} more`);
          }
        }
      } else {
        spinner.stop("Remote sync completed");
      }
    }

    for (const warning of syncResult.warnings) {
      if (!options.quiet) {
        clack.log.warn(warning.message);
      }
    }

    for (const pushResult of syncResult.results) {
      if (!pushResult.success && pushResult.error) {
        if (!pushResult.skipped && !options.quiet) {
          clack.log.error(
            `Failed to sync to ${pushResult.remoteId}: ${pushResult.error}`,
          );
        }
      }
    }

    return { ok: true, state };
  } catch (_error) {
    if (!options.quiet) {
      stopSpinnerSilently(spinner);
    }
    if (options.verbose) {
      clack.log.warn(
        `Remote push failed: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
    return { ok: true, state };
  }
};
