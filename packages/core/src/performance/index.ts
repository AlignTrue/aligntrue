/**
 * Performance guardrails and resource limits
 *
 * Provides utilities for:
 * - File size validation with mode-dependent behavior
 * - .gitignore pattern filtering for git operations
 * - Additional ignore patterns from config
 */

import ignore from "ignore";
import { statSync, existsSync, readFileSync } from "fs";

/**
 * Check file size against limits
 *
 * Behavior:
 * - Solo mode: Warns to stderr, continues
 * - Team mode: Throws error, aborts operation
 * - Force flag: Bypasses all checks
 */
export function checkFileSize(
  filePath: string,
  maxSizeMb: number,
  mode: "solo" | "team" | "enterprise",
  force: boolean,
): void {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = statSync(filePath);
  const sizeMb = stats.size / (1024 * 1024);

  if (sizeMb > maxSizeMb) {
    const message = `File exceeds size limit: ${filePath} (${sizeMb.toFixed(2)}MB > ${maxSizeMb}MB)`;

    if (force) {
      // Force flag bypasses all checks
      return;
    }

    if (mode === "solo") {
      // Solo mode: warn and continue
      console.warn(`⚠️  ${message}`);
      return;
    }

    // Team/enterprise mode: error and abort
    throw new Error(`${message}\nUse --force to override this limit.`);
  }
}

/**
 * Create .gitignore filter using 'ignore' package
 *
 * Returns a filter function that returns true if path should be ignored.
 *
 * @param gitignorePath - Path to .gitignore file (optional)
 * @param additionalPatterns - Additional ignore patterns from config
 * @returns Filter function (true = should ignore)
 */
export function createIgnoreFilter(
  gitignorePath?: string,
  additionalPatterns: string[] = [],
): (path: string) => boolean {
  const ig = ignore();

  // Add .gitignore patterns if file exists
  if (gitignorePath && existsSync(gitignorePath)) {
    try {
      const gitignoreContent = readFileSync(gitignorePath, "utf-8");
      ig.add(gitignoreContent);
    } catch {
      // If .gitignore can't be read, continue without it
      console.warn(`⚠️  Could not read .gitignore: ${gitignorePath}`);
    }
  }

  // Add additional patterns from config
  if (additionalPatterns.length > 0) {
    ig.add(additionalPatterns);
  }

  // Return filter function (true = should ignore)
  return (path: string) => {
    // Normalize path for ignore matching (remove leading ./ or /)
    const normalizedPath = path.replace(/^\.\//, "").replace(/^\//, "");
    return ig.ignores(normalizedPath);
  };
}

export { processInParallel, aggregateErrors } from "./parallel.js";

export type { ParallelResult } from "./parallel.js";
