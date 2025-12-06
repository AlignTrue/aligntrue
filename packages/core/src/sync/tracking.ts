/**
 * Sync tracking and hash management
 * Centralized source of truth for sync detection and change tracking.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
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

/**
 * Interface for stored source rule hashes
 * Used to detect changes in .aligntrue/rules/*.md files
 */
export interface SourceRuleHashes {
  version: "1";
  rules: Record<string, string>; // relative path -> SHA-256 hash
  config_hash: string; // Hash of .aligntrue/config.yaml
  updated_at: number; // For human debugging only
}

/**
 * Stored export file hashes for drift detection of generated agent files
 */
export interface ExportFileHashes {
  version: "1";
  files: Record<string, string>; // relative path -> SHA-256 hash
  updated_at: number;
}

/**
 * Get stored source rule hashes
 * @param cwd - Workspace root directory
 */
export function getSourceRuleHashes(cwd: string): SourceRuleHashes | null {
  const hashFile = join(cwd, ".aligntrue", ".source-rule-hashes.json");

  if (!existsSync(hashFile)) {
    return null;
  }

  try {
    const content = readFileSync(hashFile, "utf-8");
    return JSON.parse(content) as SourceRuleHashes;
  } catch {
    return null;
  }
}

/**
 * Store source rule hashes
 * Called after successful sync to save hashes of all source rules
 * @param cwd - Workspace root directory
 * @param rules - Map of relative file paths to content hashes
 * @param configHash - Hash of .aligntrue/config.yaml
 */
export function storeSourceRuleHashes(
  cwd: string,
  rules: Record<string, string>,
  configHash: string,
): void {
  const hashFile = join(cwd, ".aligntrue", ".source-rule-hashes.json");

  const hashes: SourceRuleHashes = {
    version: "1",
    rules,
    config_hash: configHash,
    updated_at: Date.now(),
  };

  try {
    const dir = dirname(hashFile);
    mkdirSync(dir, { recursive: true });
    writeFileSync(hashFile, JSON.stringify(hashes, null, 2), "utf-8");
  } catch (err) {
    console.warn(`Failed to save source rule hashes: ${err}`);
  }
}

/**
 * Get stored export file hashes
 * Used to detect manual edits to generated agent files
 */
export function getExportFileHashes(cwd: string): ExportFileHashes | null {
  const hashFile = join(cwd, ".aligntrue", ".agent-export-hashes.json");

  if (!existsSync(hashFile)) {
    return null;
  }

  try {
    const content = readFileSync(hashFile, "utf-8");
    const parsed = JSON.parse(content) as ExportFileHashes & {
      exports?: Record<string, string>;
    };

    // Backward compatibility: older versions stored hashes under "exports"
    if (!parsed.files && parsed.exports) {
      return {
        version: parsed.version || "1",
        files: parsed.exports,
        updated_at: parsed.updated_at || Date.now(),
      };
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Store export file hashes after successful sync
 * @param cwd - Workspace root directory
 * @param files - Map of relative file paths to content hashes
 */
export function storeExportFileHashes(
  cwd: string,
  files: Record<string, string>,
): void {
  const hashFile = join(cwd, ".aligntrue", ".agent-export-hashes.json");

  const hashes: ExportFileHashes = {
    version: "1",
    files,
    updated_at: Date.now(),
  };

  try {
    const dir = dirname(hashFile);
    mkdirSync(dir, { recursive: true });
    writeFileSync(hashFile, JSON.stringify(hashes, null, 2), "utf-8");
  } catch (err) {
    console.warn(`Failed to save export file hashes: ${err}`);
  }
}

/**
 * Detect changes in source rules by comparing content hashes
 * Returns true if sync is needed
 *
 * Sync needed if:
 * - No stored hashes (first sync or backward compatibility)
 * - Config hash changed
 * - Any rule file hash changed
 * - New rule files added
 * - Rule files deleted
 *
 * @param cwd - Workspace root directory
 * @param currentRules - Map of relative file paths to content hashes
 * @param currentConfigHash - Hash of .aligntrue/config.yaml
 * @returns true if sync is needed, false if everything is up to date
 */
export function detectSourceRuleChanges(
  cwd: string,
  currentRules: Record<string, string>,
  currentConfigHash: string,
): boolean {
  const stored = getSourceRuleHashes(cwd);

  // No stored hashes = first sync or backward compatibility
  if (!stored) {
    return true;
  }

  // Config changed
  if (stored.config_hash !== currentConfigHash) {
    return true;
  }

  // Check for added or modified rules
  for (const [path, hash] of Object.entries(currentRules)) {
    const storedHash = stored.rules[path];
    if (!storedHash || storedHash !== hash) {
      return true;
    }
  }

  // Check for deleted rules
  for (const path of Object.keys(stored.rules)) {
    if (!(path in currentRules)) {
      return true;
    }
  }

  // Everything matches
  return false;
}
