/**
 * Lockfile I/O with atomic writes (v2)
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
import type { Lockfile, LockfileV1 } from "./types.js";
import { isV1Lockfile } from "./types.js";

const V2_MIGRATION_MARKER_FILE = "lockfile-v2-migration.json";

/**
 * Read lockfile from disk
 *
 * Supports both v1 and v2 formats. v1 lockfiles will be detected
 * and can be migrated by running sync again.
 *
 * @param path - Path to lockfile (typically .aligntrue/lock.json)
 * @returns Lockfile object or null if not found
 */
export function readLockfile(path: string): Lockfile | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, "utf8");
    const lockfile = JSON.parse(content) as Lockfile | LockfileV1;

    // Basic validation - must have version and bundle_hash
    if (!lockfile.version || !lockfile.bundle_hash) {
      throw new Error("Invalid lockfile structure");
    }

    // If v1 format, extract just what we need
    if (isV1Lockfile(lockfile)) {
      return {
        version: "1", // Keep version to detect migration needed
        bundle_hash: lockfile.bundle_hash,
      };
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

  // Check if migrating from v1 to v2
  if (existsSync(path) && !options?.silent) {
    try {
      const oldLockfile = JSON.parse(readFileSync(path, "utf-8")) as
        | Lockfile
        | LockfileV1;
      if (
        isV1Lockfile(oldLockfile) &&
        lockfile.version === "2" &&
        !hasV2MigrationMarker(path)
      ) {
        console.log("✓ Upgraded lockfile to v2 format (simplified)");
        writeV2MigrationMarker(path);
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

function getV2MigrationMarkerPath(lockfilePath: string): string {
  const aligntrueDir = dirname(lockfilePath);
  return join(aligntrueDir, ".cache", V2_MIGRATION_MARKER_FILE);
}

function hasV2MigrationMarker(lockfilePath: string): boolean {
  const markerPath = getV2MigrationMarkerPath(lockfilePath);
  if (!existsSync(markerPath)) {
    return false;
  }
  try {
    const data = JSON.parse(readFileSync(markerPath, "utf-8")) as {
      v2_migration_completed?: boolean;
    };
    return Boolean(data?.v2_migration_completed);
  } catch {
    return false;
  }
}

function writeV2MigrationMarker(lockfilePath: string): void {
  try {
    const markerPath = getV2MigrationMarkerPath(lockfilePath);
    const markerDir = dirname(markerPath);
    ensureDirectoryExists(markerDir);
    writeFileSync(
      markerPath,
      JSON.stringify({ v2_migration_completed: true }, null, 2),
      "utf-8",
    );
  } catch {
    // Ignore marker write failures (non-critical)
  }
}
