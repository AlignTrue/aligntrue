/**
 * Ignore file management
 * Handles reading, updating, and creating agent ignore files
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import type { AgentConflict } from "./detector.js";
import { getIgnorePatterns, getNestedIgnorePatterns } from "./detector.js";

export interface IgnoreFileUpdate {
  /** Path to ignore file */
  filePath: string;
  /** Patterns to add */
  patterns: string[];
  /** Whether file was created (vs updated) */
  created: boolean;
  /** Whether file was modified */
  modified: boolean;
}

const ALIGNTRUE_MARKER_START = "# AlignTrue: Prevent duplicate context";
const ALIGNTRUE_MARKER_END = "# AlignTrue: End duplicate prevention";

/**
 * Read existing ignore file content
 * @param filePath - Path to ignore file
 * @returns File content or empty string if file doesn't exist
 */
export function readIgnoreFile(filePath: string): string {
  if (!existsSync(filePath)) {
    return "";
  }

  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Parse ignore file into lines
 * @param content - File content
 * @returns Array of lines (trimmed, non-empty)
 */
export function parseIgnoreFile(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Check if pattern already exists in ignore file
 * @param content - File content
 * @param pattern - Pattern to check
 * @returns True if pattern exists
 */
export function hasPattern(content: string, pattern: string): boolean {
  const lines = parseIgnoreFile(content);
  return lines.some((line) => {
    // Skip comments
    if (line.startsWith("#")) {
      return false;
    }
    // Exact match or pattern match
    return line === pattern || line.includes(pattern);
  });
}

/**
 * Check if ignore file has AlignTrue managed section
 * @param content - File content
 * @returns True if AlignTrue section exists
 */
export function hasAlignTrueSection(content: string): boolean {
  return content.includes(ALIGNTRUE_MARKER_START);
}

/**
 * Extract AlignTrue managed patterns from ignore file
 * @param content - File content
 * @returns Array of managed patterns
 */
export function extractAlignTruePatterns(content: string): string[] {
  const lines = content.split("\n");
  const patterns: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.includes(ALIGNTRUE_MARKER_START)) {
      inSection = true;
      continue;
    }
    if (line.includes(ALIGNTRUE_MARKER_END)) {
      inSection = false;
      continue;
    }
    if (inSection && line.trim() && !line.trim().startsWith("#")) {
      patterns.push(line.trim());
    }
  }

  return patterns;
}

/**
 * Remove AlignTrue managed section from ignore file
 * @param content - File content
 * @returns Content without AlignTrue section
 */
export function removeAlignTrueSection(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.includes(ALIGNTRUE_MARKER_START)) {
      inSection = true;
      continue;
    }
    if (line.includes(ALIGNTRUE_MARKER_END)) {
      inSection = false;
      continue;
    }
    if (!inSection) {
      result.push(line);
    }
  }

  // Remove trailing empty lines
  while (
    result.length > 0 &&
    (result[result.length - 1]?.trim() ?? "").length === 0
  ) {
    result.pop();
  }

  return result.join("\n");
}

/**
 * Build AlignTrue managed section content
 * @param patterns - Patterns to include
 * @returns Section content
 */
export function buildAlignTrueSection(patterns: string[]): string {
  if (patterns.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("");
  lines.push(ALIGNTRUE_MARKER_START);
  lines.push("# Managed by AlignTrue to prevent duplicate agent context");
  lines.push("# Edit .aligntrue/config.yaml to change this behavior");
  lines.push("");

  for (const pattern of patterns) {
    lines.push(pattern);
  }

  lines.push("");
  lines.push(ALIGNTRUE_MARKER_END);

  return lines.join("\n");
}

/**
 * Update ignore file with new patterns
 * @param filePath - Path to ignore file
 * @param patterns - Patterns to add
 * @param dryRun - If true, don't write file
 * @returns Update result
 */
export function updateIgnoreFile(
  filePath: string,
  patterns: string[],
  dryRun = false,
): IgnoreFileUpdate {
  const exists = existsSync(filePath);
  const existingContent = exists ? readIgnoreFile(filePath) : "";

  // Filter out patterns that already exist (outside AlignTrue section)
  const contentWithoutSection = removeAlignTrueSection(existingContent);
  const newPatterns = patterns.filter(
    (p) => !hasPattern(contentWithoutSection, p),
  );

  // If no new patterns and AlignTrue section exists, no update needed
  if (newPatterns.length === 0 && hasAlignTrueSection(existingContent)) {
    return {
      filePath,
      patterns: [],
      created: false,
      modified: false,
    };
  }

  // Build new content
  let newContent = contentWithoutSection;

  // Add AlignTrue section with all patterns (existing + new)
  const existingManaged = extractAlignTruePatterns(existingContent);
  const allPatterns = [...new Set([...existingManaged, ...newPatterns])];
  const section = buildAlignTrueSection(allPatterns);

  if (newContent.trim()) {
    newContent = newContent + "\n" + section;
  } else {
    newContent = section.trim();
  }

  // Ensure trailing newline
  if (!newContent.endsWith("\n")) {
    newContent += "\n";
  }

  // Write file if not dry run
  if (!dryRun) {
    const dir = dirname(filePath);
    ensureDirectoryExists(dir);
    writeFileSync(filePath, newContent, "utf-8");
  }

  return {
    filePath,
    patterns: newPatterns,
    created: !exists,
    modified: exists && newPatterns.length > 0,
  };
}

/**
 * Apply conflict resolution to ignore files
 * @param conflict - Agent conflict
 * @param rootDir - Root directory
 * @param dryRun - If true, don't write files
 * @returns Array of updates
 */
export function applyConflictResolution(
  conflict: AgentConflict,
  rootDir: string,
  dryRun = false,
): IgnoreFileUpdate[] {
  const updates: IgnoreFileUpdate[] = [];
  const patterns = getIgnorePatterns(conflict);

  if (patterns.length === 0) {
    return updates;
  }

  // Update root ignore file
  const rootIgnorePath = join(rootDir, conflict.ignoreFile);
  const rootUpdate = updateIgnoreFile(rootIgnorePath, patterns, dryRun);
  if (rootUpdate.created || rootUpdate.modified) {
    updates.push(rootUpdate);
  }

  return updates;
}

/**
 * Apply conflict resolution to nested scope ignore files
 * @param conflict - Agent conflict
 * @param rootDir - Root directory
 * @param scopePaths - Array of scope paths (e.g., ["apps/web", "packages/api"])
 * @param dryRun - If true, don't write files
 * @returns Array of updates
 */
export function applyNestedConflictResolution(
  conflict: AgentConflict,
  rootDir: string,
  scopePaths: string[],
  dryRun = false,
): IgnoreFileUpdate[] {
  const updates: IgnoreFileUpdate[] = [];

  if (!conflict.supportsNested) {
    return updates;
  }

  for (const scopePath of scopePaths) {
    const patterns = getNestedIgnorePatterns(conflict, scopePath);
    if (patterns.length === 0) {
      continue;
    }

    const scopeIgnorePath = join(rootDir, scopePath, conflict.ignoreFile);
    const update = updateIgnoreFile(scopeIgnorePath, patterns, dryRun);
    if (update.created || update.modified) {
      updates.push(update);
    }
  }

  return updates;
}

/**
 * Remove AlignTrue managed patterns from ignore file
 * @param filePath - Path to ignore file
 * @param dryRun - If true, don't write file
 * @returns True if file was modified
 */
export function removeAlignTruePatterns(
  filePath: string,
  dryRun = false,
): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  const content = readIgnoreFile(filePath);
  if (!hasAlignTrueSection(content)) {
    return false;
  }

  const newContent = removeAlignTrueSection(content);

  if (!dryRun) {
    if (newContent.trim()) {
      // File has other content, update it
      writeFileSync(filePath, newContent + "\n", "utf-8");
    } else {
      // File is empty after removing section, could delete but safer to leave empty
      writeFileSync(filePath, "", "utf-8");
    }
  }

  return true;
}
