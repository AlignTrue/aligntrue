/**
 * Agent detection cache
 * Caches detected agents to avoid repeated filesystem checks
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface DetectionCache {
  timestamp: string;
  detected: string[];
  configured: string[];
}

/**
 * Load agent detection cache
 *
 * @param cwd - Current working directory
 * @returns Cached detection result or null if not found
 */
export function loadDetectionCache(cwd: string): DetectionCache | null {
  const cachePath = join(cwd, ".aligntrue", ".cache", "detected-agents.json");
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save agent detection cache
 *
 * @param cwd - Current working directory
 * @param cache - Detection cache to save
 */
export function saveDetectionCache(cwd: string, cache: DetectionCache): void {
  const cachePath = join(cwd, ".aligntrue", ".cache", "detected-agents.json");
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}
