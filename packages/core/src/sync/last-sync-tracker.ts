/**
 * Centralized last sync timestamp tracking
 * Single source of truth for both sync detection and drift detection
 */

import {
  existsSync,
  readFileSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";

/**
 * Get the timestamp of the last successful sync operation
 * Returns null if no previous sync has occurred
 *
 * @param cwd - Workspace root directory
 * @returns Timestamp in milliseconds, or null if no previous sync
 */
export function getLastSyncTimestamp(cwd: string): number | null {
  const lastSyncFile = join(cwd, ".aligntrue", ".last-sync");

  if (!existsSync(lastSyncFile)) {
    return null;
  }

  try {
    const content = readFileSync(lastSyncFile, "utf-8");
    const timestamp = parseInt(content.trim(), 10);
    return isNaN(timestamp) ? null : timestamp;
  } catch {
    return null;
  }
}

/**
 * Update the last sync timestamp to current time
 * Should be called after a successful sync operation
 *
 * @param cwd - Workspace root directory
 */
export function updateLastSyncTimestamp(cwd: string): void {
  const lastSyncFile = join(cwd, ".aligntrue", ".last-sync");
  const timestamp = Date.now();

  try {
    const dir = dirname(lastSyncFile);
    mkdirSync(dir, { recursive: true });
    // Simple write is sufficient as this is only used for "last synced X ago" messages
    // Drift detection now uses content hashes, so precise timestamp ordering is not critical
    writeFileSync(lastSyncFile, timestamp.toString(), "utf-8");
  } catch (err) {
    // Log error for debugging but don't fail the sync
    console.warn(
      `Warning: Failed to update last sync timestamp at ${lastSyncFile}\n` +
        `  ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Check if a file was modified since the given timestamp
 *
 * @param filePath - Path to file to check
 * @param timestamp - Reference timestamp in milliseconds
 * @returns True if file was modified after timestamp
 */
export function wasFileModifiedSince(
  filePath: string,
  timestamp: number,
): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const stats = statSync(filePath);
    const modified = stats.mtimeMs > timestamp;

    // Debug logging for change detection
    if (process.env["DEBUG_CHANGE_DETECTION"]) {
      console.log(`Change detection for ${filePath}:`, {
        fileModified: new Date(stats.mtimeMs).toISOString(),
        lastSync: new Date(timestamp).toISOString(),
        isModified: modified,
        diffMs: stats.mtimeMs - timestamp,
      });
    }

    return modified;
  } catch (err) {
    if (process.env["DEBUG_CHANGE_DETECTION"]) {
      console.warn(`Failed to check modification time for ${filePath}:`, err);
    }
    return false;
  }
}

/**
 * Get file modification time in milliseconds
 *
 * @param filePath - Path to file
 * @returns Modification time in milliseconds, or null if file doesn't exist
 */
export function getFileModificationTime(filePath: string): number | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const stats = statSync(filePath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}
