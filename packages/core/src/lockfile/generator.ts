/**
 * Lockfile generator v2 - simplified bundle hash only
 *
 * No per-rule tracking - just a single hash that covers:
 * - All .aligntrue/rules/*.md file hashes (excluding scope: personal)
 * - .aligntrue/config.team.yaml hash
 */

import { existsSync, readFileSync } from "fs";
import { computeHash } from "@aligntrue/schema";
import type { Lockfile } from "./types.js";
import type { RuleFile } from "../rules/file-io.js";
import { getAlignTruePaths } from "../paths.js";

/**
 * Generate lockfile v2 from rule files
 *
 * Creates a single bundle_hash covering all team-managed content:
 * - Team-scoped rule file hashes (sorted for determinism)
 * - Team config file hash (if exists)
 *
 * @param rules - Array of rule files to include
 * @param cwd - Working directory for finding team config
 * @returns Lockfile with version and bundle_hash
 */
export function generateLockfile(rules: RuleFile[], cwd: string): Lockfile {
  const paths = getAlignTruePaths(cwd);
  const hashes: string[] = [];

  // Filter to team-scoped rules (exclude personal)
  const teamRules = rules.filter((rule) => {
    const frontmatter = rule.frontmatter as Record<string, unknown>;
    return frontmatter["scope"] !== "personal";
  });

  // Collect rule hashes (sorted by filename for determinism)
  const sortedRules = [...teamRules].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );

  for (const rule of sortedRules) {
    hashes.push(rule.hash);
  }

  // Include team config hash if it exists
  const teamConfigHash = computeFileHash(paths.teamConfig);
  if (teamConfigHash) {
    hashes.push(teamConfigHash);
  }

  // Compute bundle hash from all hashes
  const bundleHash = computeBundleHash(hashes);

  return {
    version: "2",
    bundle_hash: bundleHash,
  };
}

/**
 * Compute bundle hash from sorted hashes
 */
function computeBundleHash(hashes: string[]): string {
  if (hashes.length === 0) {
    // Empty state - hash of empty string
    return computeHash("");
  }
  const combined = hashes.join("\n");
  return computeHash(combined);
}

/**
 * Compute hash of a file's contents
 * Returns undefined if file doesn't exist
 */
function computeFileHash(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const content = readFileSync(path, "utf-8");
    return computeHash(content);
  } catch {
    return undefined;
  }
}
