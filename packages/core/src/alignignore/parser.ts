/**
 * .alignignore parser
 * Gitignore-style file pattern matching for AlignTrue
 * Prevents AlignTrue from editing, deleting, or overwriting specified files
 */

import { readFileSync } from "fs";
import ignore, { type Ignore } from "ignore";

export interface AlignignorePattern {
  pattern: string;
  negation: boolean;
}

/**
 * Parse .alignignore file into patterns (gitignore format)
 * @param content - File content
 * @returns Array of patterns
 */
export function parseAlignignore(content: string): AlignignorePattern[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines.map((line) => {
    const negation = line.startsWith("!");
    const pattern = negation ? line.slice(1) : line;
    return { pattern: pattern.trim(), negation };
  });
}

/**
 * Read .alignignore file
 * @param alignignorePath - Path to .alignignore
 * @returns File content or empty string if doesn't exist
 */
export function readAlignignore(alignignorePath: string): string {
  try {
    return readFileSync(alignignorePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Create ignore checker from patterns
 * @param patterns - Parsed patterns from .alignignore
 * @returns Ignore checker instance
 */
function createIgnoreChecker(patterns: AlignignorePattern[]): Ignore {
  const ig = ignore();

  // Add patterns in order to the ignore checker
  for (const { pattern, negation } of patterns) {
    if (negation) {
      // Negation pattern (re-include)
      ig.add(`!${pattern}`);
    } else {
      // Regular ignore pattern
      ig.add(pattern);
    }
  }

  return ig;
}

/**
 * Check if a path should be ignored based on .alignignore patterns
 * Uses gitignore-style negation: last matching pattern wins
 * @param filePath - File path relative to repo root (forward slashes)
 * @param patterns - Parsed patterns from .alignignore
 * @returns true if file should be ignored
 */
export function shouldIgnorePath(
  filePath: string,
  patterns: AlignignorePattern[],
): boolean {
  if (patterns.length === 0) {
    return false;
  }

  const ig = createIgnoreChecker(patterns);
  // ignore package uses forward slashes and returns true for ignored paths
  return ig.ignores(filePath);
}

/**
 * Check if path should be ignored with full .alignignore file
 * @param filePath - File path (normalized to forward slashes)
 * @param alignignorePath - Path to .alignignore (if doesn't exist, no files ignored)
 * @returns true if file should be ignored
 */
export function isIgnoredByAlignignore(
  filePath: string,
  alignignorePath: string,
): boolean {
  const content = readAlignignore(alignignorePath);
  if (!content) {
    return false;
  }

  const patterns = parseAlignignore(content);
  return shouldIgnorePath(filePath, patterns);
}
