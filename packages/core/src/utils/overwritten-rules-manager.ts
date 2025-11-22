/**
 * Overwritten Rules Manager
 * Handles backup of overwritten rule files and extraction of overwritten sections
 *
 * Two-tier safety system:
 * 1. File-level: overwritten-rules/ folder for complete file backups with timestamp
 *    - Used when switching edit_source from one file to another
 *    - Preserves original path structure: AGENTS.md → overwritten-rules/AGENTS.2025-11-21T15-30-00.md
 *    - Used when replacing entire files with new content
 *
 * 2. Section-level: overwritten-rules.md for conflicting sections during merge
 *    - Used when last-write-wins resolution occurs during section merging
 *    - Includes source file and timestamp metadata
 *    - Useful for auditing what was overwritten and when
 *
 * Both are optional safety features that users can review and delete at any time.
 */

import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";

/**
 * Format timestamp as YYYY-MM-DDTHH-MM-SS for file names
 */
export function formatTimestampForFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

/**
 * Backup a file that is being completely overwritten
 * Preserves the original path structure with a timestamp
 *
 * Example: AGENTS.md → overwritten-rules/AGENTS.2025-11-21T15-30-00.md
 * Example: .cursor/rules/debugging.mdc → overwritten-rules/cursor/rules/debugging.2025-11-21T15-30-00.mdc
 *
 * @param sourcePath - Absolute path to file being overwritten
 * @param cwd - Current working directory
 * @param timestamp - Optional timestamp for naming (uses current time if not provided)
 * @returns Path to the backed-up file
 */
export function backupOverwrittenFile(
  sourcePath: string,
  cwd: string,
  timestamp?: string,
): string {
  const ts = timestamp || formatTimestampForFilename();
  const overwrittenRulesDir = join(cwd, ".aligntrue", "overwritten-rules");

  // Get relative path from cwd
  let relativePath = sourcePath;
  if (sourcePath.startsWith(cwd)) {
    relativePath = sourcePath.slice(cwd.length + 1);
  }

  // Split into directory and filename
  const dir = dirname(relativePath);
  const filename = relativePath.split(/[\\/]/).pop() || "file";
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const nameWithoutExt = ext ? filename.slice(0, -(ext.length + 1)) : filename;

  // Build new filename with timestamp
  const newFilename = ext
    ? `${nameWithoutExt}.${ts}.${ext}`
    : `${filename}.${ts}`;

  // Build target path preserving directory structure
  const targetDir =
    dir && dir !== "." ? join(overwrittenRulesDir, dir) : overwrittenRulesDir;
  const targetPath = join(targetDir, newFilename);

  // Ensure target directory exists
  ensureDirectoryExists(targetDir);

  // Copy file
  copyFileSync(sourcePath, targetPath);

  return targetPath;
}

/**
 * Append a conflicting section to overwritten-rules.md
 * Used when last-write-wins resolution happens during merge
 *
 * @param cwd - Current working directory
 * @param section - Section object with heading and content
 * @param sourceFile - Original file the section came from
 * @param timestamp - Optional timestamp for metadata
 */
export function appendOverwrittenSection(
  cwd: string,
  section: { heading: string; content: string },
  sourceFile: string,
  timestamp?: string,
): void {
  const ts = timestamp || new Date().toISOString().split("T")[0];
  const overwrittenRulesPath = join(cwd, ".aligntrue", "overwritten-rules.md");

  // Ensure .aligntrue directory exists
  ensureDirectoryExists(join(cwd, ".aligntrue"));

  // Check if file exists and has content
  let header = "";
  try {
    readFileSync(overwrittenRulesPath, "utf-8");
    // File exists, just append
  } catch {
    // File doesn't exist, add header
    header = `# Overwritten Rules

This file contains rule sections that were automatically overwritten during syncs.
These are saved as a safety feature. You can review and delete any sections at any time.

---

`;
  }

  // Build section entry
  const entry = `## ${section.heading}

**Source:** ${sourceFile}
**Date:** ${ts}

${section.content}

---

`;

  // Append to file
  const fullContent = header + entry;
  writeFileSync(overwrittenRulesPath, fullContent, {
    flag: "a",
    encoding: "utf-8",
  });
}

/**
 * Check if a file backup already exists with given name pattern
 * Useful for avoiding timestamp collisions
 *
 * @param sourcePath - Absolute path to file being backed up
 * @param cwd - Current working directory
 * @returns True if backup exists, false otherwise
 */
export function checkBackupExists(sourcePath: string, cwd: string): boolean {
  const overwrittenRulesDir = join(cwd, ".aligntrue", "overwritten-rules");

  // Get relative path
  let relativePath = sourcePath;
  if (sourcePath.startsWith(cwd)) {
    relativePath = sourcePath.slice(cwd.length + 1);
  }

  const dir = dirname(relativePath);
  const filename = relativePath.split(/[\\/]/).pop() || "file";
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const _nameWithoutExt = ext ? filename.slice(0, -(ext.length + 1)) : filename;

  // Pattern to match: nameWithoutExt.YYYY-MM-DDTHH-MM-SS.ext
  const _timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;
  const _targetDir =
    dir && dir !== "." ? join(overwrittenRulesDir, dir) : overwrittenRulesDir;

  try {
    // Note: In real implementation, would use fs.readdirSync to check
    // For now, just return false to allow fresh backups
    // Variables prefixed with _ are intentionally unused until implementation
    return false;
  } catch {
    return false;
  }
}

export interface BackupResult {
  backed_up: boolean;
  target_path?: string;
  error?: string;
}

/**
 * Safely backup a file with error handling
 *
 * @param sourcePath - Absolute path to file being overwritten
 * @param cwd - Current working directory
 * @returns Result indicating success/failure
 */
export function safeBackupFile(sourcePath: string, cwd: string): BackupResult {
  try {
    const targetPath = backupOverwrittenFile(sourcePath, cwd);
    return {
      backed_up: true,
      target_path: targetPath,
    };
  } catch (error) {
    return {
      backed_up: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
