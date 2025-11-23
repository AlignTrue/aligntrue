/**
 * Shared utility for matching file paths against edit_source patterns
 * Used by exporters to determine if a file is editable or read-only
 */

import micromatch from "micromatch";

/**
 * Check if a file path matches edit_source pattern(s)
 *
 * @param filePath - Relative file path from project root (e.g., "apps/web/AGENTS.md")
 * @param editSource - Pattern(s) from config.sync.edit_source
 * @returns true if file is in edit_source (editable), false if read-only
 *
 * @example
 * // Exact path match
 * matchesEditSource('AGENTS.md', 'AGENTS.md') // true
 *
 * // Glob pattern
 * matchesEditSource('.cursor/rules/test.mdc', '.cursor/rules/*.mdc') // true
 *
 * // Recursive glob
 * matchesEditSource('apps/web/AGENTS.md', '**\/AGENTS.md') // true
 *
 * // Array of patterns
 * matchesEditSource('AGENTS.md', ['AGENTS.md', '.cursor/rules/*.mdc']) // true
 */
export function matchesEditSource(
  filePath: string,
  editSource: string | string[] | undefined,
): boolean {
  // No edit_source configured: all files are editable (default)
  if (!editSource) {
    return true;
  }

  // Normalize path separators to forward slashes (cross-platform)
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Convert to array for consistent handling
  const patterns = Array.isArray(editSource) ? editSource : [editSource];

  // Check if path matches any pattern using micromatch (supports globs)
  return micromatch.isMatch(normalizedPath, patterns);
}
