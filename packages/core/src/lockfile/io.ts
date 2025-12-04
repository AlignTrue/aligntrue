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
const LOCATION_MIGRATION_MARKER_FILE = "lockfile-location-migration.json";

/**
 * Read lockfile from disk
 *
 * Supports migration from old location (.aligntrue.lock.json) to new location (.aligntrue/lock.json)
 *
 * @param path - Path to lockfile (typically .aligntrue/lock.json)
 * @returns Lockfile object or null if not found
 */
export function readLockfile(path: string): Lockfile | null {
  // Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
  if (!existsSync(path)) {
    // Check if old location exists and migrate
    const oldPath = getOldLockfilePath(path);
    if (existsSync(oldPath) && !hasLocationMigrationMarker(path)) {
      try {
        // Safe: Old path is derived from new path (safe internal path)
        const content = readFileSync(oldPath, "utf8");
        const lockfile = JSON.parse(content) as Lockfile;

        // Migrate: write to new location and delete old
        writeLockfile(path, lockfile, { silent: true });
        // Safe: Old path is derived from new path (safe internal path)
        unlinkSync(oldPath);

        // Mark migration as complete
        writeLocationMigrationMarker(path);

        // Log migration once per workspace
        console.log("✓ Migrated lockfile to .aligntrue/lock.json");

        return lockfile;
      } catch {
        // Fall through to return null if migration fails
      }
    }
    return null;
  }

  try {
    // Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
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
 * @param path - Path to lockfile (typically .aligntrue/lock.json)
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

  // Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
  if (existsSync(path) && !options?.silent) {
    try {
      // Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
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
    // Safe: Temp path derived from lockfile path (typically from getAlignTruePaths().lockfile)
    writeFileSync(tempPath, json, "utf8");

    // Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
    renameSync(tempPath, path);

    // Verify file was written successfully

    // Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
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
  // lockfilePath is .aligntrue/lock.json, so dirname gives us .aligntrue
  const aligntrueDir = dirname(lockfilePath);
  return join(aligntrueDir, ".cache", HASH_MIGRATION_MARKER_FILE);
}

function hasHashMigrationMarker(lockfilePath: string): boolean {
  const markerPath = getMigrationMarkerPath(lockfilePath);

  // Safe: Marker path derived from lockfile path (typically from getAlignTruePaths().lockfile)
  if (!existsSync(markerPath)) {
    return false;
  }
  try {
    // Safe: Marker path derived from lockfile path (typically from getAlignTruePaths().lockfile)
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

    // Safe: Marker path derived from lockfile path (typically from getAlignTruePaths().lockfile)
    writeFileSync(
      markerPath,
      JSON.stringify({ hash_migration_completed: true }, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore marker write failures (non-critical)
  }
}

/**
 * Get the old lockfile path (before migration to .aligntrue directory)
 * @param newPath - Current lockfile path (.aligntrue/lock.json)
 * @returns Old lockfile path (.aligntrue.lock.json in workspace root)
 */
function getOldLockfilePath(newPath: string): string {
  const workspaceDir = dirname(dirname(newPath)); // Go up from .aligntrue/
  return join(workspaceDir, ".aligntrue.lock.json");
}

/**
 * Get marker file path for location migration
 */
function getLocationMigrationMarkerPath(lockfilePath: string): string {
  // lockfilePath is .aligntrue/lock.json, so dirname gives us .aligntrue
  const aligntrueDir = dirname(lockfilePath);
  return join(aligntrueDir, ".cache", LOCATION_MIGRATION_MARKER_FILE);
}

/**
 * Check if location migration has already been done
 */
function hasLocationMigrationMarker(lockfilePath: string): boolean {
  const markerPath = getLocationMigrationMarkerPath(lockfilePath);

  // Safe: Marker path derived from lockfile path (safe internal path)
  if (!existsSync(markerPath)) {
    return false;
  }
  try {
    // Safe: Marker path derived from lockfile path (safe internal path)
    const data = JSON.parse(readFileSync(markerPath, "utf-8")) as {
      location_migration_completed?: boolean;
    };
    return Boolean(data?.location_migration_completed);
  } catch {
    return false;
  }
}

/**
 * Write marker indicating location migration is complete
 */
function writeLocationMigrationMarker(lockfilePath: string): void {
  try {
    const markerPath = getLocationMigrationMarkerPath(lockfilePath);
    const markerDir = dirname(markerPath);
    ensureDirectoryExists(markerDir);

    // Safe: Marker path derived from lockfile path (safe internal path)
    writeFileSync(
      markerPath,
      JSON.stringify({ location_migration_completed: true }, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore marker write failures (non-critical)
  }
}
