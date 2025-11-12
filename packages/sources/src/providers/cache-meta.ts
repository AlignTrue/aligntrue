/**
 * Cache metadata management for git sources
 * Tracks ref types, update strategies, and last check times
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export type RefType = "branch" | "tag" | "commit";
export type UpdateStrategy = "check" | "never";

export interface CacheMeta {
  url: string;
  ref: string;
  refType: RefType;
  resolvedSha: string;
  lastFetched: string; // ISO timestamp
  lastChecked: string; // ISO timestamp
  updateStrategy: UpdateStrategy;
}

const CACHE_META_FILE = ".cache-meta.json";

/**
 * Detect ref type from ref string
 * - Commit: 40-char hex string (full SHA) or 7+ char hex (short SHA)
 * - Tag: starts with 'v' followed by semver pattern
 * - Branch: everything else
 */
export function detectRefType(ref: string): RefType {
  // Check for commit SHA (full or short)
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    return "commit";
  }

  // Check for semver tag patterns
  // v1.2.3, v1.2.3-alpha, v1.2.3-beta.1, etc.
  if (/^v?\d+\.\d+\.\d+/.test(ref)) {
    return "tag";
  }

  // Everything else is a branch
  return "branch";
}

/**
 * Load cache metadata from repository directory
 * Returns null if metadata file doesn't exist
 */
export function loadCacheMeta(repoDir: string): CacheMeta | null {
  const metaPath = join(repoDir, CACHE_META_FILE);

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content) as CacheMeta;
  } catch (error) {
    // Corrupted metadata file
    console.warn(
      `Failed to load cache metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Save cache metadata to repository directory
 */
export function saveCacheMeta(repoDir: string, meta: CacheMeta): void {
  const metaPath = join(repoDir, CACHE_META_FILE);

  try {
    const content = JSON.stringify(meta, null, 2);
    writeFileSync(metaPath, content, "utf-8");
  } catch (error) {
    // Non-fatal, just log warning
    console.warn(
      `Failed to save cache metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Check if cache should be checked for updates based on TTL
 * @param meta - Cache metadata
 * @param intervalSeconds - Check interval in seconds
 * @returns true if cache should be checked for updates
 */
export function shouldCheckForUpdates(
  meta: CacheMeta,
  intervalSeconds: number,
): boolean {
  // Never check if strategy is 'never'
  if (meta.updateStrategy === "never") {
    return false;
  }

  // Parse last checked timestamp
  const lastChecked = new Date(meta.lastChecked);
  const now = new Date();

  // Calculate time since last check in seconds
  const secondsSinceCheck = (now.getTime() - lastChecked.getTime()) / 1000;

  // Should check if interval has elapsed
  return secondsSinceCheck >= intervalSeconds;
}

/**
 * Determine update strategy from ref type
 */
export function getUpdateStrategy(refType: RefType): UpdateStrategy {
  return refType === "commit" ? "never" : "check";
}
