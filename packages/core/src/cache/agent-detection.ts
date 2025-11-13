/**
 * Agent detection cache
 * Caches agent detection results to avoid repeated filesystem checks
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";

export interface DetectionCache {
  timestamp: string;
  detected: string[];
  configured: string[];
}

const CACHE_FILE_NAME = "detection-cache.json";

/**
 * Load agent detection cache from .aligntrue/.cache/detection-cache.json
 *
 * @param cwd - Current working directory
 * @returns Cached detection data or null if not found/invalid
 */
export function loadDetectionCache(cwd: string): DetectionCache | null {
  const cachePath = join(cwd, ".aligntrue", ".cache", CACHE_FILE_NAME);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const content = readFileSync(cachePath, "utf-8");
    return JSON.parse(content) as DetectionCache;
  } catch {
    // Return null if cache is corrupted
    return null;
  }
}

/**
 * Save agent detection cache to .aligntrue/.cache/detection-cache.json
 *
 * @param cwd - Current working directory
 * @param cache - Detection cache object to save
 */
export function saveDetectionCache(cwd: string, cache: DetectionCache): void {
  const cacheDir = join(cwd, ".aligntrue", ".cache");
  ensureDirectoryExists(cacheDir);

  const cachePath = join(cacheDir, CACHE_FILE_NAME);
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}
