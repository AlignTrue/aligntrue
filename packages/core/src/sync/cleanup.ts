/**
 * Cleanup utilities for format switching
 *
 * Handles safe removal of old export files when switching between
 * native and agents-md formats, with backup to overwritten-files folder.
 */

import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "fs";
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
    const ext = fileName.replace("*", "");
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
 */
function createBackupDir(outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(outputDir, "overwritten-files", timestamp);
  mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

/**
 * Backup a file to the backup directory, preserving relative path
 */
function backupFile(
  file: string,
  outputDir: string,
  backupDir: string,
): string {
  const relativePath = file.startsWith(outputDir)
    ? file.slice(outputDir.length + 1)
    : basename(file);

  const backupPath = join(backupDir, relativePath);
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
 * Get cleanup patterns for an agent
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
