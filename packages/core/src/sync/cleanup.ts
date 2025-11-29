/**
 * Cleanup utilities for format switching
 *
 * Handles safe removal of old export files when switching between
 * native and agents-md formats, with backup to unified .aligntrue/.backups/files/ folder.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "fs";
import { join, dirname, basename } from "path";
import type { CleanupMode } from "../config/types.js";

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Files that were removed */
  removed: string[];
  /** Files that were backed up */
  backedUp: string[];
  /** Path to the backup directory */
  backupDir: string;
  /** Any warnings during cleanup */
  warnings: string[];
}

/**
 * Agent file patterns for cleanup
 * Maps agent names to their output file patterns (glob-like)
 */
const AGENT_PATTERNS: Record<string, string[]> = {
  cursor: [".cursor/rules/*.mdc"],
  agents: ["AGENTS.md"],
  amazonq: [".amazonq/rules/*.md"],
  kilocode: [".kilocode/rules/*.md"],
  augmentcode: [".augment/rules/*.md"],
  kiro: [".kiro/steering/*.md"],
  "trae-ai": [".trae/rules/*.md"],
  "vscode-mcp": [".vscode/mcp.json"],
  copilot: ["AGENTS.md"], // Uses AGENTS.md
  claude: ["AGENTS.md"], // Uses AGENTS.md
  aider: ["AGENTS.md"], // Uses AGENTS.md
  codex: ["AGENTS.md"], // Uses AGENTS.md
};

/**
 * Get all files matching a pattern in a directory
 */
function getFilesMatchingPattern(outputDir: string, pattern: string): string[] {
  const files: string[] = [];

  // Parse pattern: e.g., ".cursor/rules/*.mdc"
  const parts = pattern.split("/");
  const fileName = parts.pop() || "";
  const subDir = parts.join("/");
  const fullDir = subDir ? join(outputDir, subDir) : outputDir;

  if (!existsSync(fullDir)) {
    return files;
  }

  // Check if it's a glob pattern
  if (fileName.includes("*")) {
    // Simple glob: *.mdc matches all .mdc files
    const ext = fileName.replaceAll("*", "");
    try {
      const entries = readdirSync(fullDir);
      for (const entry of entries) {
        if (entry.endsWith(ext) || (ext === "" && fileName === "*")) {
          files.push(join(fullDir, entry));
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  } else {
    // Exact file
    const fullPath = join(fullDir, fileName);
    if (existsSync(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Create backup directory and return its path
 * Uses unified .aligntrue/.backups/files/ location with timestamp
 */
function createBackupDir(outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  // Use unified backup location under .aligntrue
  const cwd = outputDir;
  const backupDir = join(cwd, ".aligntrue", ".backups", "files", timestamp);
  mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

/**
 * Backup a file to the backup directory, preserving relative path
 * Adds .bak suffix to make backups clear at a glance
 */
function backupFile(
  file: string,
  outputDir: string,
  backupDir: string,
): string {
  const relativePath = file.startsWith(outputDir)
    ? file.slice(outputDir.length + 1)
    : basename(file);

  // Add .bak suffix to backed-up files
  const backupPath = join(backupDir, `${relativePath}.bak`);
  mkdirSync(dirname(backupPath), { recursive: true });

  try {
    renameSync(file, backupPath);
    return backupPath;
  } catch (err) {
    throw new Error(`Failed to backup ${file}: ${err}`);
  }
}

/**
 * Clean up old export files for an agent when switching formats
 *
 * @param outputDir - The output directory (usually workspace root)
 * @param agent - The agent name
 * @param mode - Cleanup mode: "all" removes all matching files, "managed" only removes tracked files
 * @param trackedFiles - Files previously tracked by AlignTrue (for "managed" mode)
 * @returns Cleanup result with removed files, backups, and warnings
 */
export async function cleanupOldExports(
  outputDir: string,
  agent: string,
  mode: CleanupMode = "all",
  trackedFiles?: string[],
): Promise<CleanupResult> {
  const result: CleanupResult = {
    removed: [],
    backedUp: [],
    backupDir: "",
    warnings: [],
  };

  const patterns = AGENT_PATTERNS[agent];
  if (!patterns) {
    result.warnings.push(`No cleanup patterns defined for agent: ${agent}`);
    return result;
  }

  // Find all files matching patterns
  const filesToClean: string[] = [];
  for (const pattern of patterns) {
    const matches = getFilesMatchingPattern(outputDir, pattern);
    filesToClean.push(...matches);
  }

  if (filesToClean.length === 0) {
    return result;
  }

  // Filter based on mode
  let filesToRemove = filesToClean;
  if (mode === "managed" && trackedFiles) {
    const trackedSet = new Set(trackedFiles.map((f) => join(outputDir, f)));
    filesToRemove = filesToClean.filter((f) => trackedSet.has(f));
  }

  if (filesToRemove.length === 0) {
    return result;
  }

  // Check .alignignore before cleanup
  const { isIgnoredByAlignignore } = await import("../alignignore/index.js");
  const { resolve, relative } = await import("path");
  const cwd = process.cwd();
  const alignignorePath = resolve(cwd, ".alignignore");

  // Filter out files protected by .alignignore
  filesToRemove = filesToRemove.filter((file) => {
    const absolutePath = resolve(cwd, file);
    const relativePath = relative(cwd, absolutePath).replace(/\\/g, "/");
    if (isIgnoredByAlignignore(relativePath, alignignorePath)) {
      result.warnings.push(
        `File protected by .alignignore, skipping cleanup: ${file}`,
      );
      return false;
    }
    return true;
  });

  if (filesToRemove.length === 0) {
    return result;
  }

  // Create backup directory
  result.backupDir = createBackupDir(outputDir);

  // Backup and remove files
  for (const file of filesToRemove) {
    try {
      const backupPath = backupFile(file, outputDir, result.backupDir);
      result.backedUp.push(backupPath);
      result.removed.push(file);
    } catch (err) {
      result.warnings.push(`Failed to cleanup ${file}: ${err}`);
    }
  }

  return result;
}

/**
 * Clean up empty directories after file removal
 */
export function cleanupEmptyDirs(dir: string): void {
  if (!existsSync(dir)) {
    return;
  }

  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) {
      return;
    }

    const entries = readdirSync(dir);
    if (entries.length === 0) {
      // Directory is empty, remove it
      const { rmdirSync } = require("fs");
      rmdirSync(dir);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Get cleanup patterns for an agent (legacy format switching)
 */
export function getAgentPatterns(agent: string): string[] {
  return AGENT_PATTERNS[agent] || [];
}

/**
 * Check if any files exist for an agent's format
 */
export function agentHasExistingFiles(
  outputDir: string,
  agent: string,
): boolean {
  const patterns = AGENT_PATTERNS[agent] || [];
  for (const pattern of patterns) {
    const matches = getFilesMatchingPattern(outputDir, pattern);
    if (matches.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get all multi-file exporter paths
 */
export function getAllMultiFileExporterPaths(): Record<string, string> {
  return { ...MULTI_FILE_EXPORTERS };
}

/**
 * Multi-file exporter configuration
 * Maps agent names to their export directory paths
 */
const MULTI_FILE_EXPORTERS: Record<string, string> = {
  cursor: ".cursor/rules",
  amazonq: ".amazonq/rules",
  kilocode: ".kilocode/rules",
  augmentcode: ".augment/rules",
  kiro: ".kiro/steering",
  "trae-ai": ".trae/rules",
  openhands: ".openhands/microagents",
  "openhands-config": ".openhands/microagents",
  cline: ".cline/rules",
  "firebase-studio": ".firebase-studio/rules",
  windsurf: ".windsurf/rules",
  roocode: ".roocode/rules",
  zed: ".zed/rules",
  goose: ".goose/rules",
  crush: ".crush/rules",
  warp: ".warp/rules",
  junie: ".junie/rules",
  jules: ".jules/rules",
  opencode: ".opencode/rules",
  "qwen-code": ".qwen-code/rules",
};

/**
 * Get export directory for a multi-file exporter
 * @param agent - Agent name
 * @returns Directory path or undefined if single-file exporter
 */
export function getMultiFileExporterPath(agent: string): string | undefined {
  return MULTI_FILE_EXPORTERS[agent];
}

/**
 * Result of stale export detection
 */
export interface StaleExportGroup {
  /** Directory where stale files were found (relative to output dir) */
  directory: string;
  /** Agent name */
  agent: string;
  /** Stale files (exports with no matching source) */
  files: string[];
}

/**
 * Detect stale exported files (exports with no matching source rule)
 *
 * Scans multi-file export directories and identifies files that don't
 * correspond to any current source rule. This includes orphans from renamed
 * or deleted source files.
 *
 * Only checks multi-file exporters (single-file formats are fully rewritten
 * on each sync, so stale files can't accumulate).
 *
 * @param outputDir - The output directory (usually workspace root)
 * @param sourceRuleNames - Base filenames of current source rules (without extension)
 * @param activeExporters - List of active exporter names
 * @returns Array of stale export groups found
 *
 * @example
 * ```typescript
 * const stale = detectStaleExports('/workspace', ['security', 'testing'], ['cursor', 'amazonq']);
 * // Returns: [{
 * //   directory: '.cursor/rules',
 * //   agent: 'cursor',
 * //   files: ['old-security.mdc', 'legacy-rule.mdc']
 * // }]
 * ```
 */
export function detectStaleExports(
  outputDir: string,
  sourceRuleNames: string[],
  activeExporters: string[],
): StaleExportGroup[] {
  const staleGroups: StaleExportGroup[] = [];

  // Normalize source rule names to lowercase for case-insensitive matching
  const sourceNamesLower = sourceRuleNames.map((name) => name.toLowerCase());

  for (const agent of activeExporters) {
    const dirPath = getMultiFileExporterPath(agent);
    if (!dirPath) continue; // Skip single-file exporters

    const fullDir = join(outputDir, dirPath);

    // Skip if directory doesn't exist
    if (!existsSync(fullDir)) continue;

    try {
      const entries = readdirSync(fullDir);
      const staleFiles: string[] = [];

      for (const entry of entries) {
        const filePath = join(fullDir, entry);

        try {
          const stat = statSync(filePath);

          // Skip directories
          if (stat.isDirectory()) continue;

          // Extract base name (without extension) from exported filename
          // Examples: "ai-guidance.mdc" -> "ai-guidance", "style.md" -> "style"
          const baseNameMatch = entry.match(/^(.+?)\.[^.]+$/);
          const baseName = baseNameMatch?.[1] || entry;
          const baseNameLower = baseName.toLowerCase();

          // Check if this file corresponds to a current source rule
          const hasMatchingSource = sourceNamesLower.includes(baseNameLower);

          if (!hasMatchingSource) {
            // This is a stale file - no matching source
            staleFiles.push(entry);
          }
        } catch {
          // Skip files that can't be read (TOCTOU race condition)
        }
      }

      if (staleFiles.length > 0) {
        staleGroups.push({
          directory: dirPath,
          agent,
          files: staleFiles.sort(),
        });
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  return staleGroups;
}

/**
 * Result of cleaning stale exports
 */
export interface CleanResult {
  /** Files that were deleted */
  deleted: string[];
  /** Total size freed (bytes) */
  freedBytes: number;
  /** Any warnings during cleanup */
  warnings: string[];
}

/**
 * Clean stale exported files
 *
 * Deletes all exported files that don't have a corresponding source rule.
 * Respects .alignignore protection.
 *
 * @param outputDir - The output directory (usually workspace root)
 * @param staleGroups - Stale export groups from detectStaleExports()
 * @returns Clean result with deleted files and freed space
 *
 * @example
 * ```typescript
 * const stale = detectStaleExports(cwd, sourceNames, ['cursor']);
 * const result = cleanStaleExports(cwd, stale);
 * console.log(`Removed ${result.deleted.length} stale files`);
 * ```
 */
export async function cleanStaleExports(
  outputDir: string,
  staleGroups: StaleExportGroup[],
): Promise<CleanResult> {
  const result: CleanResult = {
    deleted: [],
    freedBytes: 0,
    warnings: [],
  };

  if (staleGroups.length === 0) {
    return result;
  }

  // Check .alignignore protection
  const { isIgnoredByAlignignore } = await import("../alignignore/index.js");
  const { resolve, relative } = await import("path");
  const cwd = process.cwd();
  const alignignorePath = resolve(cwd, ".alignignore");

  for (const group of staleGroups) {
    const fullDir = join(outputDir, group.directory);

    for (const filename of group.files) {
      const filePath = join(fullDir, filename);

      try {
        // Check if file is protected by .alignignore
        const absolutePath = resolve(cwd, filePath);
        const relativePath = relative(cwd, absolutePath).replace(/\\/g, "/");
        if (isIgnoredByAlignignore(relativePath, alignignorePath)) {
          result.warnings.push(
            `File protected by .alignignore, skipping: ${relativePath}`,
          );
          continue;
        }

        const stat = statSync(filePath);
        result.freedBytes += stat.size;

        // Delete the file
        unlinkSync(filePath);
        result.deleted.push(filename);
      } catch (err) {
        result.warnings.push(
          `Failed to delete ${filename}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return result;
}
