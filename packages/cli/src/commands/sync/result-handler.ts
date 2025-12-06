/**
 * Sync result handler - displays results, conflicts, telemetry
 */

import { existsSync, readFileSync } from "fs";
import { relative, basename, join } from "path";
import * as clack from "@clack/prompts";
import { computeHash } from "@aligntrue/schema";
import {
  updateLastSyncTimestamp,
  storeSourceRuleHashes,
  storeExportFileHashes,
  detectStaleExports,
  cleanStaleExports,
  type SourceRuleInfo,
} from "@aligntrue/core/sync";
import { getExporterNames } from "@aligntrue/core";
import type { SyncContext } from "./context-builder.js";
import type { SyncOptions } from "./options.js";
import type { SyncResult } from "./workflow.js";
import { exitWithError } from "../../utils/command-utilities.js";
import { AlignTrueError } from "../../utils/error-types.js";

/**
 * Handle and display sync results
 */
export async function handleSyncResult(
  result: SyncResult,
  context: SyncContext,
  options: SyncOptions,
): Promise<void> {
  const { cwd, registry } = context;

  if (!result.success) {
    const warnings = result.warnings || [];
    if (warnings.length > 0) {
      warnings.forEach((warning) => {
        clack.log.error(warning);
      });
    }

    const hint =
      warnings.length > 0
        ? "Resolve the errors above and re-run: aligntrue sync"
        : undefined;

    exitWithError(1, "Sync failed", hint ? { hint } : undefined);
  }

  // Show written files in verbose mode or if quiet is off
  // Sort files alphabetically for deterministic output
  if (result.written && result.written.length > 0 && options.verbose) {
    const uniqueFiles = Array.from(new Set(result.written)).sort();
    uniqueFiles.forEach((file) => {
      clack.log.info(`  ${file}`);
    });
  }

  // Show audit trail in dry-run
  if (options.dryRun && result.auditTrail && result.auditTrail.length > 0) {
    displayAuditTrail(result.auditTrail);
  }

  // Show provenance in dry-run
  if (options.dryRun && result.auditTrail) {
    displayProvenance(result.auditTrail);
  }

  // Group all warnings at the end
  if (result.warnings && result.warnings.length > 0) {
    displayWarnings(
      result.warnings,
      options.verbose || false,
      options.quiet || false,
    );
  }

  // Show conflict summary if any (after warnings)
  if (result.conflicts && result.conflicts.length > 0) {
    await displayConflicts(
      result.conflicts,
      options.showConflicts || false,
      options.verbose || false,
      options,
    );
  }

  // Check for agent format conflicts and offer to manage ignore files
  // Important: This must happen BEFORE clack.outro() to preserve spinner/message state
  const exporterNames = getExporterNames(context.config.exporters);
  if (!options.dryRun && exporterNames.length > 1) {
    const autoManage = context.config.sync?.auto_manage_ignore_files ?? true;

    // Only check if not explicitly disabled
    if (autoManage !== false) {
      const {
        detectConflicts,
        applyConflictResolution,
        applyNestedConflictResolution,
        formatConflictMessage,
        formatWarningMessage,
      } = await import("@aligntrue/core/agent-ignore");

      // Get per-exporter config for ignore_file setting
      const exporterConfigs: Record<string, { ignore_file?: boolean }> = {};
      if (
        context.config.exporters &&
        typeof context.config.exporters === "object" &&
        !Array.isArray(context.config.exporters)
      ) {
        Object.assign(exporterConfigs, context.config.exporters);
      }

      // Filter exporters to only those with ignore_file enabled (default: true)
      const exportersWithIgnoreEnabled = exporterNames.filter((name) => {
        const config = exporterConfigs[name];
        return config?.ignore_file !== false; // Default to true
      });

      const detection = detectConflicts(
        exportersWithIgnoreEnabled,
        context.config.sync?.custom_format_priority,
      );

      if (detection.hasIssues) {
        // Collect all ignore file updates
        const allIgnoreUpdates = [];

        // Handle conflicts that can be resolved with ignore files
        for (const conflict of detection.conflicts) {
          const shouldPrompt =
            (autoManage === "prompt" || autoManage === undefined) &&
            !options.yes &&
            !options.nonInteractive &&
            !options.autoEnable;

          if (shouldPrompt) {
            const message = formatConflictMessage(conflict);
            const shouldManage = await clack.confirm({
              message,
              initialValue: true,
            });

            if (clack.isCancel(shouldManage) || !shouldManage) {
              continue;
            }
          } else if (autoManage !== true) {
            continue;
          }

          try {
            // Apply root ignore file updates
            const updates = applyConflictResolution(conflict, cwd, false);

            // Apply nested scope ignore files for both configured scopes and rules with nested_location
            const scopePaths = context.config.scopes?.map((s) => s.path) || [];

            // Also include nested locations from rules (e.g., apps/docs, packages/cli)
            // Load rule files directly to access frontmatter (AlignSection doesn't have frontmatter)
            const nestedLocations = new Set<string>();
            const rulesDir = join(cwd, ".aligntrue", "rules");
            if (existsSync(rulesDir)) {
              const { loadRulesDirectory } = await import("@aligntrue/core");
              const ruleFiles = await loadRulesDirectory(rulesDir, cwd, {
                recursive: true,
              });
              for (const rule of ruleFiles) {
                const loc = rule.frontmatter.nested_location;
                if (typeof loc === "string" && loc) {
                  nestedLocations.add(loc);
                }
              }
            }

            // Combine both scope paths and nested locations
            const allNestedPaths = [
              ...scopePaths,
              ...Array.from(nestedLocations),
            ];

            const nestedUpdates = applyNestedConflictResolution(
              conflict,
              cwd,
              allNestedPaths,
              false,
            );

            allIgnoreUpdates.push(...updates, ...nestedUpdates);
          } catch (error) {
            clack.log.warn(
              `Failed to update ignore file: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Handle agents with ignore_file disabled: clean up their ignore files
        const exportersWithIgnoreDisabled = exporterNames.filter((name) => {
          const config = exporterConfigs[name];
          return config?.ignore_file === false;
        });

        if (exportersWithIgnoreDisabled.length > 0) {
          const { getAgentIgnoreSpec, removeAlignTruePatterns } = await import(
            "@aligntrue/core/agent-ignore"
          );
          for (const agentName of exportersWithIgnoreDisabled) {
            const spec = getAgentIgnoreSpec(agentName);
            if (spec) {
              try {
                const ignoreFilePath = join(cwd, spec.ignoreFile);
                const wasModified = removeAlignTruePatterns(
                  ignoreFilePath,
                  false,
                );
                if (wasModified) {
                  allIgnoreUpdates.push({
                    filePath: ignoreFilePath,
                    patterns: [],
                    created: false,
                    modified: true,
                  });
                }
              } catch (error) {
                if (options.verbose) {
                  clack.log.warn(
                    `Failed to clean up ignore file for ${agentName}: ${error instanceof Error ? error.message : String(error)}`,
                  );
                }
              }
            }
          }
        }

        // Show simplified ignore file message
        if (allIgnoreUpdates.length > 0) {
          const createdFiles = allIgnoreUpdates
            .filter((u) => u.created)
            .map((u) => basename(u.filePath));
          const modifiedFiles = allIgnoreUpdates
            .filter((u) => u.modified)
            .map((u) => basename(u.filePath));

          if (createdFiles.length > 0 || modifiedFiles.length > 0) {
            clack.log.info(`Enabled ignore files updated.`);
          }
        }

        // Show warnings for agents without ignore support (verbose mode only)
        if (detection.warnings.length > 0 && options.verbose) {
          for (const warning of detection.warnings) {
            const message = formatWarningMessage(warning);
            clack.log.warn(message);
          }
        }
      }
    }
  }

  // Update last sync timestamp after successful sync
  if (!options.dryRun) {
    try {
      updateLastSyncTimestamp(cwd);

      // Store source rule hashes for sync detection
      // This enables reliable change detection in checkIfSyncNeeded()
      const { readFileSync, existsSync: fsExists } = await import("fs");
      const { join: pathJoin } = await import("path");

      try {
        const { globSync } = await import("glob");
        const sourceRulesDir = pathJoin(cwd, ".aligntrue", "rules");
        if (fsExists(sourceRulesDir)) {
          const ruleFiles = globSync("**/*.md", {
            cwd: sourceRulesDir,
            absolute: true,
          });
          const currentRules: Record<string, string> = {};

          // Compute hash for each rule file
          for (const file of ruleFiles) {
            try {
              const content = readFileSync(file, "utf-8");
              const hash = computeHash(content);
              const relPath = file.replace(cwd + "/", "");
              currentRules[relPath] = hash;
            } catch {
              // Ignore read errors, hashing will be attempted again on next sync
            }
          }

          // Compute config hash
          const configPath =
            context.configPath || pathJoin(cwd, ".aligntrue", "config.yaml");
          let configHash = "";
          try {
            const configContent = readFileSync(configPath, "utf-8");
            configHash = computeHash(configContent);
          } catch {
            // Ignore read errors
          }

          if (configHash) {
            storeSourceRuleHashes(cwd, currentRules, configHash);
          }
        }

        // Store export file hashes for drift detection of generated agent files
        if (result.written && result.written.length > 0) {
          const uniqueWritten = Array.from(new Set(result.written));
          const exportHashes: Record<string, string> = {};

          for (const file of uniqueWritten) {
            if (!fsExists(file)) {
              continue;
            }

            // Only track files within the workspace (skip temp/outside paths)
            const relPath = relative(cwd, file);
            if (relPath.startsWith("..")) {
              continue;
            }

            try {
              const content = readFileSync(file, "utf-8");
              exportHashes[relPath] = computeHash(content);
            } catch {
              // Ignore read errors; hashes will refresh on next successful sync
            }
          }

          if (Object.keys(exportHashes).length > 0) {
            storeExportFileHashes(cwd, exportHashes);
          }
        }
      } catch (err) {
        // Log warning but don't fail sync
        if (options.verbose) {
          clack.log.warn(
            `Failed to store source rule hashes: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      // Log warning but don't fail sync
      if (options.verbose) {
        clack.log.warn(
          `Failed to update last sync timestamp: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Verify lockfile status when enabled
  // Important: This must happen BEFORE clack.outro()
  const lockfileExpected =
    context.config.mode === "team" && context.config.modules?.lockfile;
  if (!options.dryRun && lockfileExpected && result.lockfilePath) {
    if (existsSync(result.lockfilePath)) {
      clack.log.success(
        `Lockfile updated: ${relative(cwd, result.lockfilePath)}`,
      );
    } else {
      clack.log.warn(
        `Expected lockfile at ${result.lockfilePath} but it was not found. Run 'aligntrue sync' again to regenerate.`,
      );
    }
  }

  // Detect stale exported files (exports at wrong location or orphaned)
  // This runs even when no source changes, as exports may need cleanup
  if (!options.dryRun && !options.quiet) {
    const activeExporters = registry
      .list()
      .map((name) => registry.get(name)!)
      .filter(Boolean)
      .map((a) => a.name);

    // Build source rule info with nested_location for proper stale detection
    // This ensures exports at wrong locations (e.g., root when rule has nested_location) are flagged
    const sourceRules: SourceRuleInfo[] = [];

    // Load rule files to get frontmatter with nested_location
    const rulesDir = join(cwd, ".aligntrue", "rules");
    if (existsSync(rulesDir)) {
      try {
        const { loadRulesDirectory } = await import("@aligntrue/core");
        const ruleFiles = await loadRulesDirectory(rulesDir, cwd, {
          recursive: true,
        });
        for (const rule of ruleFiles) {
          // Skip disabled rules so their existing exports are treated as stale
          if (rule.frontmatter.enabled === false) {
            continue;
          }
          // Use filename without extension as the rule name
          const name = rule.filename.replace(/\.md$/, "");
          const nestedLocation = rule.frontmatter.nested_location;
          sourceRules.push({
            name,
            nestedLocation:
              typeof nestedLocation === "string" ? nestedLocation : undefined,
          });
        }
      } catch (err) {
        // Fall back to bundle result if rule files can't be loaded
        if (options.verbose) {
          clack.log.warn(`Failed to load rules for stale detection: ${err}`);
        }
        for (const section of context.bundleResult.align.sections) {
          const typedSection = section as {
            fingerprint?: string;
            heading?: string;
          };
          const name =
            typedSection.fingerprint ||
            typedSection.heading?.replace(/^#+\s*/, "") ||
            "unknown";
          if (name !== "unknown") {
            sourceRules.push({ name });
          }
        }
      }
    }

    const staleGroups = detectStaleExports(cwd, sourceRules, activeExporters);

    if (staleGroups.length > 0) {
      if (options.clean) {
        // Clean mode: remove stale files automatically
        const cleanResult = await cleanStaleExports(cwd, staleGroups);

        if (cleanResult.deleted.length > 0) {
          clack.log.success(
            `Removed ${cleanResult.deleted.length} stale export file${cleanResult.deleted.length !== 1 ? "s" : ""}`,
          );
          if (options.verbose) {
            cleanResult.deleted.forEach((file: string) => {
              clack.log.info(`  Deleted: ${file}`);
            });
          }
        }

        if (cleanResult.warnings.length > 0) {
          cleanResult.warnings.forEach((warning: string) => {
            clack.log.warn(`  ${warning}`);
          });
        }
      } else {
        // Warning mode: inform user about stale exports and how to remove them
        const fileCount = staleGroups.reduce(
          (sum, g) => sum + g.files.length,
          0,
        );
        clack.log.warn(
          `Found ${fileCount} stale export file${fileCount !== 1 ? "s" : ""} (no matching source):`,
        );
        for (const group of staleGroups) {
          for (const file of group.files) {
            clack.log.warn(`  ${group.directory}/${file}`);
          }
        }
        clack.log.info("To remove stale exports: aligntrue sync --clean");
      }
    }
  }

  // Sync succeeded - show success summary LAST (ending with outro)
  if (!options.quiet) {
    if (options.dryRun) {
      clack.log.info("Dry-run mode: no files written");
    } else {
      const loadedExporters = registry
        .list()
        .map((name) => registry.get(name)!)
        .filter(Boolean);
      const exporterNames = loadedExporters.map((a) => a.name);
      const writtenFiles = result.written || [];
      const uniqueWrittenFiles = Array.from(new Set(writtenFiles));
      const hasChanges = uniqueWrittenFiles.length > 0;

      if (hasChanges) {
        // Show success message with files written
        // Sort files alphabetically for deterministic output
        const sortedFiles = [...uniqueWrittenFiles].sort();
        let message = "✓ Sync complete\n\n";

        // Add source summary showing precedence
        if (context.config.sources && context.config.sources.length > 0) {
          const sourceCount = context.config.sources.length;
          if (sourceCount === 1) {
            const source = context.config.sources[0];
            if (source) {
              const sourceDisplay =
                source.type === "git"
                  ? `${source.url || ""}${source.path ? `/${source.path}` : ""}`
                  : source.type === "local"
                    ? source.path || "(local)"
                    : source.url || "(unknown)";
              message += `Source: ${sourceDisplay}\n\n`;
            }
          } else {
            message += "Sources (highest priority first):\n";
            for (let i = 0; i < context.config.sources.length; i++) {
              const source = context.config.sources[i];
              if (!source) continue;
              const sourceDisplay =
                source.type === "git"
                  ? `${source.url || ""}${source.path ? `/${source.path}` : ""}`
                  : source.type === "local"
                    ? source.path || "(local)"
                    : source.url || "(unknown)";
              message += `  ${i + 1}. ${sourceDisplay}\n`;
            }
            message += "\n";
          }
        }

        // Build relative paths for files
        const relativeFiles = sortedFiles.map((file) => {
          try {
            return relative(cwd, file);
          } catch {
            return file;
          }
        });

        message += `Synced to ${exporterNames.length} agent${exporterNames.length !== 1 ? "s" : ""}: ${relativeFiles.slice(0, 5).join(", ")}${relativeFiles.length > 5 ? `, +${relativeFiles.length - 5} more` : ""}\n\n`;
        message +=
          "Tip: Update rules anytime by editing .aligntrue/rules and running: aligntrue sync\n";
        message += "Docs: aligntrue.ai/sources";
        clack.outro(message);
      } else {
        clack.outro("✓ Everything up to date - no changes needed");
      }
    }
  }
}

/**
 * Display warnings with optional verbose mode and quiet mode
 */
function displayWarnings(
  warnings: string[],
  verbose: boolean,
  quiet: boolean,
): void {
  if (quiet) {
    return; // Skip all warnings in quiet mode
  }

  if (verbose) {
    // Show all warnings in verbose mode
    warnings.forEach((warning) => {
      clack.log.warn(warning);
    });
  } else {
    // Group vendor-specific warnings
    const vendorWarningPattern =
      /^\[([^\]]+)\]\s+Vendor-specific fields for other agents preserved: (.+)$/;
    const vendorWarnings: Map<string, string[]> = new Map();
    const otherWarnings: string[] = [];
    const fidelityNotes: string[] = [];

    for (const warning of warnings) {
      // Check for vendor-specific warnings
      const match = warning.match(vendorWarningPattern);
      if (match && match[1] && match[2]) {
        const agent = match[1];
        const preservedAgents = match[2];
        if (!vendorWarnings.has(preservedAgents)) {
          vendorWarnings.set(preservedAgents, []);
        }
        vendorWarnings.get(preservedAgents)!.push(agent);
      } else if (warning.startsWith("[") && warning.length > 3) {
        // Fidelity notes (other types)
        fidelityNotes.push(warning);
      } else {
        // Other warnings
        otherWarnings.push(warning);
      }
    }

    // Show consolidated vendor-specific warnings
    for (const [preservedAgents, agents] of vendorWarnings.entries()) {
      const agentList = agents.sort().join(", ");
      clack.log.warn(
        `⚠ Vendor-specific fields for ${preservedAgents} preserved by: ${agentList}`,
      );
    }

    // Show summary count for other fidelity notes
    if (fidelityNotes.length > 0) {
      clack.log.info(
        `ℹ ${fidelityNotes.length} fidelity note${fidelityNotes.length !== 1 ? "s" : ""} (use --verbose to see details)`,
      );
    }

    // Always show non-fidelity warnings
    otherWarnings.forEach((warning) => {
      clack.log.warn(warning);
    });
  }
}

/**
 * Display audit trail
 */
function displayAuditTrail(
  auditTrail: Array<{
    action: string;
    target: string;
    details?: string;
  }>,
): void {
  clack.log.info("\nAudit trail:");
  auditTrail.forEach((entry) => {
    clack.log.info(`  [${entry.action}] ${entry.target}: ${entry.details}`);
  });
}

/**
 * Display provenance information
 */
function displayProvenance(
  auditTrail: Array<{
    provenance?: {
      owner?: string;
      source?: string;
      source_sha?: string;
    };
    target: string;
  }>,
): void {
  const provenanceEntries = auditTrail.filter(
    (e) =>
      e.provenance &&
      (e.provenance.owner || e.provenance.source || e.provenance.source_sha),
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

/**
 * Display conflicts
 */
async function displayConflicts(
  conflicts: Array<{
    heading: string;
    files: Array<{ path: string; mtime: Date }>;
    winner: string;
  }>,
  showConflicts: boolean,
  verbose: boolean = false,
  options?: { dryRun?: boolean },
): Promise<void> {
  const shouldShowDetails = showConflicts || verbose;

  if (shouldShowDetails) {
    // Show full details
    console.log("\n");
    clack.log.warn("⚠️  CONFLICTS DETECTED\n");

    for (const conflict of conflicts) {
      clack.log.warn(`Section "${conflict.heading}" edited in multiple files:`);

      // Sort files by mtime to show chronologically
      const sortedFiles = [...conflict.files].sort(
        (a, b) => a.mtime.getTime() - b.mtime.getTime(),
      );

      for (const file of sortedFiles) {
        const isWinner = file.path === conflict.winner;
        const marker = isWinner ? "✓" : " ";
        // In dry-run mode, don't show timestamps for deterministic output
        if (options?.dryRun) {
          clack.log.message(`  ${marker} ${file.path}`);
        } else {
          const timeStr = file.mtime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          clack.log.message(`  ${marker} ${file.path} (modified ${timeStr})`);
        }
      }

      clack.log.message(`  → Using: ${conflict.winner} (most recent)\n`);

      // Show detailed content if --show-conflicts flag is present
      if (showConflicts) {
        await displayConflictDetails(conflict, sortedFiles);
      }
    }
  } else {
    // Show summary only
    const conflictCount = conflicts.length;
    clack.log.warn(
      `⚠ ${conflictCount} section${conflictCount !== 1 ? "s" : ""} edited in multiple files (using most recent)`,
    );
    clack.log.info(
      `Run 'aligntrue sync --show-conflicts' or 'aligntrue sync --verbose' to see details`,
    );
  }
}

/**
 * Display conflict details
 */
async function displayConflictDetails(
  conflict: { heading: string; winner: string },
  sortedFiles: Array<{ path: string; mtime: Date }>,
): Promise<void> {
  try {
    const { parseAgentsMd, parseCursorMdc } = await import("@aligntrue/schema");

    for (const file of sortedFiles) {
      const content = readFileSync(file.path, "utf-8");
      let sections;

      if (file.path.endsWith(".md")) {
        sections = parseAgentsMd(content).sections;
      } else if (file.path.endsWith(".mdc")) {
        sections = parseCursorMdc(content).sections;
      } else {
        continue;
      }

      const section = sections.find(
        (s: { heading: string }) =>
          s.heading.toLowerCase().trim() ===
          conflict.heading.toLowerCase().trim(),
      );

      if (section) {
        const isWinner = file.path === conflict.winner;
        const marker = isWinner ? "[KEPT]" : "[DISCARDED]";
        clack.log.message(`\n  ${marker} Content from ${file.path}:`);
        clack.log.message(`  ${"─".repeat(60)}`);
        const lines = section.content.split("\n");
        lines.slice(0, 10).forEach((line: string) => {
          clack.log.message(`  ${line}`);
        });
        if (lines.length > 10) {
          clack.log.message(`  ... (${lines.length - 10} more lines)`);
        }
        clack.log.message(`  ${"─".repeat(60)}`);
      }
    }
  } catch (err) {
    clack.log.warn(
      `  Could not read section content: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function derivePermissionHint(error: unknown): string | undefined {
  const err = error as NodeJS.ErrnoException;
  const code = err?.code;
  const message = (err as Error)?.message || "";
  const path = err?.path;
  const isPermission =
    code === "EACCES" ||
    code === "EPERM" ||
    message.toLowerCase().includes("permission denied");

  if (!isPermission) {
    return undefined;
  }

  if (path) {
    return `Permission denied: Fix write access to ${path} or run from a writable directory.`;
  }

  return "Permission denied: Fix directory permissions or run from a writable directory.";
}

/**
 * Handle sync error
 */
export function handleSyncError(error: Error): never {
  if (error instanceof AlignTrueError) {
    const permissionHint = derivePermissionHint(error);
    if (!error.hint && permissionHint) {
      error.hint = permissionHint;
    }
    throw error;
  }

  const message = error?.message || "Sync failed";
  const hint = derivePermissionHint(error);

  exitWithError(2, message, hint ? { hint } : undefined);
}
