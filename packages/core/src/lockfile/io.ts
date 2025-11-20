/**
 * Lockfile I/O with atomic writes
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  unlinkSync,
} from "fs";
import { dirname, join } from "path";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import type { Lockfile } from "./types.js";

const HASH_MIGRATION_MARKER_FILE = "lockfile-hash-migration.json";

/**
 * Read lockfile from disk
 *
 * @param path - Path to lockfile (typically .aligntrue.lock.json)
 * @returns Lockfile object or null if not found
 */
export function readLockfile(path: string): Lockfile | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, "utf8");
    const lockfile = JSON.parse(content) as Lockfile;

    // Basic validation
    if (!lockfile.version || !lockfile.rules || !lockfile.bundle_hash) {
      throw new Error("Invalid lockfile structure");
    }

    return lockfile;
  } catch (_err) {
    throw new Error(
      `Failed to read lockfile: ${path}\n` +
        `  ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }
}

/**
 * Write lockfile to disk atomically
 *
 * Uses temp+rename pattern to prevent partial writes
 * JSON formatted with 2-space indent and sorted keys
 *
 * @param path - Path to lockfile (typically .aligntrue.lock.json)
 * @param lockfile - Lockfile object to write
 * @param options - Optional write options
 */
export function writeLockfile(
  path: string,
  lockfile: Lockfile,
  options?: { silent?: boolean },
): void {
  // Validate path is provided
  if (!path || typeof path !== "string") {
    throw new Error(`Invalid lockfile path: ${path}`);
  }

  // Check if this is a migration from old hash format
  // (Temporary migration code - remove after 1-2 releases)
  if (existsSync(path) && !options?.silent) {
    try {
      const oldLockfile = JSON.parse(readFileSync(path, "utf-8"));
      if (
        oldLockfile.bundle_hash &&
        oldLockfile.bundle_hash !== lockfile.bundle_hash &&
        !hasHashMigrationMarker(path)
      ) {
        console.warn("ℹ Lockfile regenerated with corrected hash computation");
        console.warn(
          "  Old hash: " + oldLockfile.bundle_hash.slice(0, 12) + "...",
        );
        console.warn(
          "  New hash: " + lockfile.bundle_hash.slice(0, 12) + "...",
        );
        console.warn(
          "  This is a one-time migration for determinism improvements",
        );
        writeHashMigrationMarker(path);
      }
    } catch {
      // Ignore errors reading old lockfile
    }
  }

  // Ensure parent directory exists
  const dir = dirname(path);
  try {
    ensureDirectoryExists(dir);
  } catch (mkdirErr) {
    throw new Error(
      `Failed to create lockfile directory: ${dir}\n` +
        `  ${mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr)}`,
    );
  }

  // Serialize with sorted keys and 2-space indent
  const json = JSON.stringify(lockfile, sortKeys, 2) + "\n";

  // Atomic write: temp file + rename
  const tempPath = `${path}.tmp`;

  try {
    writeFileSync(tempPath, json, "utf8");
    renameSync(tempPath, path);

    // Verify file was written successfully
    if (!existsSync(path)) {
      throw new Error(
        `Lockfile was not created at ${path} after write operation`,
      );
    }
  } catch (_err) {
    // Clean up temp file on failure
    try {
      unlinkSync(tempPath);
    } catch {
      // File may not exist or cleanup errors
    }

    throw new Error(
      `Failed to write lockfile: ${path}\n` +
        `  ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }
}

/**
 * JSON.stringify replacer to sort keys alphabetically
 */
function sortKeys(key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const asRecord = value as Record<string, unknown>;
    return Object.keys(asRecord)
      .sort()
      .reduce<Record<string, unknown>>((sorted, property) => {
        sorted[property] = asRecord[property];
        return sorted;
      }, {});
  }
  return value;
}

function getMigrationMarkerPath(lockfilePath: string): string {
  const workspaceDir = dirname(lockfilePath);
  return join(workspaceDir, ".aligntrue", ".cache", HASH_MIGRATION_MARKER_FILE);
}

function hasHashMigrationMarker(lockfilePath: string): boolean {
  const markerPath = getMigrationMarkerPath(lockfilePath);
  if (!existsSync(markerPath)) {
    return false;
  }
  try {
    const data = JSON.parse(readFileSync(markerPath, "utf-8")) as {
      hash_migration_completed?: boolean;
    };
    return Boolean(data?.hash_migration_completed);
  } catch {
    return false;
  }
}

function writeHashMigrationMarker(lockfilePath: string): void {
  try {
    const markerPath = getMigrationMarkerPath(lockfilePath);
    const markerDir = dirname(markerPath);
    ensureDirectoryExists(markerDir);
    writeFileSync(
      markerPath,
      JSON.stringify({ hash_migration_completed: true }, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore marker write failures (non-critical)
  }
}
