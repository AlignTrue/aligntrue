/**
 * Centralized last sync timestamp tracking
 * Single source of truth for both sync detection and drift detection
 */

import {
  existsSync,
  readFileSync,
  mkdirSync,
  statSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
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
  const content = timestamp.toString();

  try {
    const dir = dirname(lastSyncFile);
    mkdirSync(dir, { recursive: true });

    // Use reliable write pattern: open -> write -> fsync -> close
    // This ensures data is flushed to disk on all platforms (critical for macOS/Linux CI)
    const fd = openSync(lastSyncFile, "w");
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    // Verify the timestamp was written successfully with retries
    // This handles race conditions where filesystem metadata lags slightly
    let written: number | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      written = getLastSyncTimestamp(cwd);
      if (written !== null && Math.abs(written - timestamp) <= 1000) {
        break;
      }
      // Small busy-wait to let filesystem settle
      const start = Date.now();
      while (Date.now() - start < 10) {
        /* busy wait */
      }
      attempts++;
    }

    if (written === null || Math.abs(written - timestamp) > 1000) {
      console.warn(
        `Warning: Last sync timestamp may not have been written correctly.\n` +
          `  Expected: ${timestamp}\n` +
          `  Read back: ${written}\n` +
          `  File: ${lastSyncFile}`,
      );
    }
  } catch (err) {
    // Log error for debugging but don't fail the sync
    console.warn(
      `Warning: Failed to update last sync timestamp at ${lastSyncFile}\n` +
        `  ${err instanceof Error ? err.message : String(err)}\n` +
        `  This may affect change detection on next sync.`,
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
