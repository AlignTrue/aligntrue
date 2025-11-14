/**
 * Sync result handler - displays results, conflicts, telemetry
 */

import { readFileSync } from "fs";
import * as clack from "@clack/prompts";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import type { SyncContext } from "./context-builder.js";
import type { SyncOptions } from "./options.js";
import type { SyncResult } from "./workflow.js";

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

  // Sync succeeded
  if (options.dryRun) {
    clack.log.info("Dry-run mode: no files written");
  }

  // Show written files
  if (result.written && result.written.length > 0) {
    const uniqueFiles = Array.from(new Set(result.written));
    clack.log.success(
      `${options.dryRun ? "Would write" : "Wrote"} ${uniqueFiles.length} file${uniqueFiles.length !== 1 ? "s" : ""}`,
    );
    uniqueFiles.forEach((file) => {
      clack.log.info(`  ${file}`);
    });
  }

  // Show warnings
  if (result.warnings && result.warnings.length > 0) {
    displayWarnings(result.warnings, options.verbose);
  }

  // Show audit trail in dry-run
  if (options.dryRun && result.auditTrail && result.auditTrail.length > 0) {
    displayAuditTrail(result.auditTrail);
  }

  // Show provenance in dry-run
  if (options.dryRun && result.auditTrail) {
    displayProvenance(result.auditTrail);
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
      align_hashes_used: [],
    });
  } catch {
    // Telemetry errors should not fail the sync command
  }

  // Show conflict summary if any
  if (result.conflicts && result.conflicts.length > 0) {
    await displayConflicts(result.conflicts, options.showConflicts);
  }

  // Show success message with next steps
  if (options.dryRun) {
    clack.outro("✓ Preview complete");
  } else {
    const loadedAdapters = registry
      .list()
      .map((name) => registry.get(name)!)
      .filter(Boolean);
    const exporterNames = loadedAdapters.map((a) => a.name);
    const writtenFiles = result.written || [];
    const uniqueWrittenFiles = Array.from(new Set(writtenFiles));

    let message = "✓ Sync complete\n\n";

    if (uniqueWrittenFiles.length > 0) {
      message += `Synced to ${exporterNames.length} agent${exporterNames.length !== 1 ? "s" : ""}:\n`;
      uniqueWrittenFiles.forEach((file) => {
        message += `  - ${file}\n`;
      });
      message += "\n";
    }

    message += "Your AI assistants are now aligned with these rules.\n\n";
    message +=
      "Next: Start coding! Your agents will follow the rules automatically.\n\n";
    message +=
      "Tip: Update rules anytime by editing AGENTS.md or any agent file and running: aligntrue sync";

    clack.outro(message);

    // Update last sync timestamp after successful sync
    try {
      const { updateLastSyncTimestamp } = await import(
        "@aligntrue/core/sync/last-sync-tracker"
      );
      updateLastSyncTimestamp(cwd);
    } catch (err) {
      // Log warning but don't fail sync
      if (options.verbose) {
        clack.log.warn(
          `Failed to update last sync timestamp: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}

/**
 * Display warnings with optional verbose mode
 */
function displayWarnings(warnings: string[], verbose: boolean): void {
  if (verbose) {
    // Show all warnings in verbose mode
    warnings.forEach((warning) => {
      clack.log.warn(warning);
    });
  } else {
    // Show summary count for fidelity notes, full text for other warnings
    const fidelityNotes = warnings.filter(
      (w) => w.startsWith("[") && w.length > 3,
    );
    const otherWarnings = warnings.filter(
      (w) => !w.startsWith("[") || w.length <= 3,
    );

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
): Promise<void> {
  console.log("\n");
  clack.log.warn("⚠️  CONFLICTS DETECTED\n");

  for (const conflict of conflicts) {
    clack.log.warn(`Section "${conflict.heading}" edited in multiple files:`);

    // Sort files by mtime to show chronologically
    const sortedFiles = [...conflict.files].sort(
      (a, b) => a.mtime.getTime() - b.mtime.getTime(),
    );

    for (const file of sortedFiles) {
      const timeStr = file.mtime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const isWinner = file.path === conflict.winner;
      const marker = isWinner ? "✓" : " ";
      clack.log.message(`  ${marker} ${file.path} (modified ${timeStr})`);
    }

    clack.log.message(`  → Using: ${conflict.winner} (most recent)\n`);

    // Show detailed content if --show-conflicts flag is present
    if (showConflicts) {
      await displayConflictDetails(conflict, sortedFiles);
    }
  }

  if (!showConflicts) {
    clack.log.info(
      `Run 'aligntrue sync --show-conflicts' to see detailed changes\n`,
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

/**
 * Handle sync error
 */
export function handleSyncError(
  error: Error,
  spinner: ReturnType<typeof clack.spinner>,
): void {
  spinner.stop("Sync failed");
  clack.log.error(
    `Sync error: ${error instanceof Error ? error.message : String(error)}`,
  );

  // Show helpful suggestions
  if (error instanceof Error) {
    if (error.message.includes("lockfile")) {
      clack.log.info("Lockfile drift detected. To approve these changes:");
      clack.log.info("  1. Review the changes above");
      clack.log.info("  2. Run: aligntrue team approve --current");
      clack.log.info("  3. Commit .aligntrue/allow.yaml to version control");
      clack.log.info("");
      clack.log.info("Or set lockfile.mode: soft in config for warnings only");
    } else if (error.message.includes("exporter")) {
      clack.log.info("Check exporter configuration in .aligntrue/config.yaml");
    }
  }

  clack.outro("✗ Sync failed");
  process.exit(2);
}
