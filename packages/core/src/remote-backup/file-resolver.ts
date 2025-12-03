/**
 * File resolver for remote backups
 *
 * Determines which files go to which backup destination
 * based on glob patterns and default assignments.
 */

import { join } from "path";
import { existsSync, readdirSync } from "fs";
import micromatch from "micromatch";
import type {
  RemoteBackupConfig,
  FileAssignment,
  FileResolutionResult,
  ResolutionWarning,
} from "./types.js";

/**
 * Collect all rule files from the rules directory
 */
function collectRuleFiles(rulesDir: string): string[] {
  if (!existsSync(rulesDir)) {
    return [];
  }

  const files: string[] = [];

  const collect = (dir: string, base: string = "") => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = base ? `${base}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        collect(fullPath, relativePath);
      } else if (entry.name.endsWith(".md")) {
        files.push(relativePath);
      }
    }
  };

  collect(rulesDir);
  return files;
}

/**
 * Normalize URL for comparison (remove trailing slashes, .git suffix)
 */
function normalizeUrl(url: string): string {
  return url
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/**
 * Resolve file assignments for remote backups
 *
 * Rules:
 * 1. Additional backups get files matching their `include` patterns
 * 2. Default backup gets all files not assigned to additional backups
 * 3. Each file can only belong to ONE backup (first match wins, warn on duplicates)
 * 4. If a URL is both a source and backup, skip that backup and warn
 */
export function resolveFileAssignments(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  config: RemoteBackupConfig,
  rulesDir: string,
  sourceUrls: string[] = [],
): FileResolutionResult {
  const warnings: ResolutionWarning[] = [];
  const assignments: FileAssignment[] = [];

  // Collect all rule files
  const allFiles = collectRuleFiles(rulesDir);

  if (allFiles.length === 0) {
    return { assignments: [], warnings: [] };
  }

  // Normalize source URLs for comparison
  const normalizedSourceUrls = new Set(sourceUrls.map(normalizeUrl));

  // Track which files have been assigned
  const assignedFiles = new Set<string>();

  // Track file duplicates for warning
  const fileToBackups = new Map<string, string[]>();

  // Process additional backups first (explicit includes)
  if (config.additional) {
    for (const additional of config.additional) {
      // Check for source/backup conflict
      const normalizedBackupUrl = normalizeUrl(additional.url);
      if (normalizedSourceUrls.has(normalizedBackupUrl)) {
        warnings.push({
          type: "source-backup-conflict",
          message: `URL configured as both source and backup. Skipping backup for: ${additional.url}. See: aligntrue.ai/backup`,
          url: additional.url,
        });
        continue;
      }

      const matchedFiles: string[] = [];

      for (const file of allFiles) {
        // Check if file matches any include pattern
        if (micromatch.isMatch(file, additional.include)) {
          // Track for duplicate detection
          const existing = fileToBackups.get(file) || [];
          existing.push(additional.id);
          fileToBackups.set(file, existing);

          // Only assign to first backup that matches
          if (!assignedFiles.has(file)) {
            matchedFiles.push(file);
            assignedFiles.add(file);
          }
        }
      }

      if (matchedFiles.length > 0) {
        assignments.push({
          backupId: additional.id,
          files: matchedFiles,
          config: additional,
        });
      }
    }
  }

  // Generate duplicate warnings
  for (const [file, backups] of fileToBackups) {
    if (backups.length > 1) {
      warnings.push({
        type: "duplicate",
        message: `File '${file}' matches multiple backups. Assigning to '${backups[0]}'. See: aligntrue.ai/backup`,
        files: [file],
      });
    }
  }

  // Process default backup (gets remaining files)
  if (config.default) {
    // Check for source/backup conflict
    const normalizedBackupUrl = normalizeUrl(config.default.url);
    if (normalizedSourceUrls.has(normalizedBackupUrl)) {
      warnings.push({
        type: "source-backup-conflict",
        message: `URL configured as both source and backup. Skipping backup for: ${config.default.url}. See: aligntrue.ai/backup`,
        url: config.default.url,
      });
    } else {
      const remainingFiles = allFiles.filter((f) => !assignedFiles.has(f));

      if (remainingFiles.length > 0) {
        assignments.push({
          backupId: "default",
          files: remainingFiles,
          config: config.default,
        });
      }
    }
  } else {
    // No default backup - warn about orphan files
    const orphanFiles = allFiles.filter((f) => !assignedFiles.has(f));
    if (orphanFiles.length > 0) {
      warnings.push({
        type: "orphan",
        message: `Files not assigned to any backup: ${orphanFiles.slice(0, 5).join(", ")}${orphanFiles.length > 5 ? ` and ${orphanFiles.length - 5} more` : ""}. Add a default backup or explicit includes.`,
        files: orphanFiles,
      });
    }
  }

  return { assignments, warnings };
}

/**
 * Get status of all configured backups
 */
export function getBackupStatus(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  config: RemoteBackupConfig,
  rulesDir: string,
  sourceUrls: string[] = [],
): {
  backups: Array<{
    id: string;
    url: string;
    branch: string;
    files: string[];
    skipped: boolean;
    skipReason?: string;
  }>;
  warnings: ResolutionWarning[];
} {
  const { assignments, warnings } = resolveFileAssignments(
    config,
    rulesDir,
    sourceUrls,
  );

  const normalizedSourceUrls = new Set(sourceUrls.map(normalizeUrl));
  const backups: Array<{
    id: string;
    url: string;
    branch: string;
    files: string[];
    skipped: boolean;
    skipReason?: string;
  }> = [];

  // Add default backup info
  if (config.default) {
    const isConflict = normalizedSourceUrls.has(
      normalizeUrl(config.default.url),
    );
    const assignment = assignments.find((a) => a.backupId === "default");
    backups.push({
      id: "default",
      url: config.default.url,
      branch: config.default.branch || "main",
      files: assignment?.files || [],
      skipped: isConflict,
      ...(isConflict && { skipReason: "URL is also configured as a source" }),
    });
  }

  // Add additional backup info
  if (config.additional) {
    for (const additional of config.additional) {
      const isConflict = normalizedSourceUrls.has(normalizeUrl(additional.url));
      const assignment = assignments.find((a) => a.backupId === additional.id);
      backups.push({
        id: additional.id,
        url: additional.url,
        branch: additional.branch || "main",
        files: assignment?.files || [],
        skipped: isConflict,
        ...(isConflict && { skipReason: "URL is also configured as a source" }),
      });
    }
  }

  return { backups, warnings };
}
