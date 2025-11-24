/**
 * Sync tracking and hash management
 * Centralized source of truth for sync detection, drift detection, and change tracking.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";
import { computeHash } from "@aligntrue/schema";

/**
 * Interface for stored agent export hashes
 */
export interface AgentExportHashes {
  version: "1";
  exports: Record<string, string>; // path -> SHA-256 hash
  updated_at: number; // For human debugging only
}

/**
 * Get stored agent export hashes
 * @param cwd - Workspace root directory
 */
export function getAgentExportHashes(cwd: string): AgentExportHashes | null {
  const hashFile = join(cwd, ".aligntrue", ".agent-export-hashes.json");

  if (!existsSync(hashFile)) {
    return null;
  }

  try {
    const content = readFileSync(hashFile, "utf-8");
    return JSON.parse(content) as AgentExportHashes;
  } catch {
    return null;
  }
}

/**
 * Store an agent export hash
 * @param cwd - Workspace root directory
 * @param agentPath - Relative path to agent file (e.g., "AGENTS.md")
 * @param content - Content to hash
 */
export function storeAgentExportHash(
  cwd: string,
  agentPath: string,
  content: string,
): void {
  const hashFile = join(cwd, ".aligntrue", ".agent-export-hashes.json");

  // Load existing hashes or create new
  const existing = getAgentExportHashes(cwd);
  const hashes: AgentExportHashes = existing || {
    version: "1",
    exports: {},
    updated_at: Date.now(),
  };

  // Compute SHA-256 hash
  const hash = computeHash(content);

  // Update hash for this file
  hashes.exports[agentPath] = hash;
  hashes.updated_at = Date.now();

  // Save back to file
  try {
    const dir = dirname(hashFile);
    mkdirSync(dir, { recursive: true });
    writeFileSync(hashFile, JSON.stringify(hashes, null, 2), "utf-8");
  } catch (err) {
    console.warn(`Failed to save agent export hashes: ${err}`);
  }
}

/**
 * Get stored hash for a specific agent file
 * @param cwd - Workspace root directory
 * @param agentPath - Relative path to agent file
 */
export function getStoredHash(cwd: string, agentPath: string): string | null {
  const hashes = getAgentExportHashes(cwd);
  return hashes?.exports[agentPath] || null;
}

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
