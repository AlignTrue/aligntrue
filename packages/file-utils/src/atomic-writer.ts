/**
 * Atomic file operations with temp + rename pattern
 * Includes checksum tracking for overwrite protection
 */

import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  statSync,
  mkdirSync,
  copyFileSync,
} from "fs";
import { dirname, join, basename } from "path";
import { randomBytes } from "crypto";
import { computeHash } from "@aligntrue/schema";

/**
 * Compute SHA-256 checksum of a file
 */
export function computeFileChecksum(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Cannot compute checksum: file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf8");
  return computeHash(content);
}

/**
 * Compute SHA-256 checksum of a string
 */
export function computeContentChecksum(content: string): string {
  return computeHash(content);
}

/**
 * Ensure directory exists, creating it if necessary
 */
export function ensureDirectoryExists(dirPath: string): void {
  try {
    mkdirSync(dirPath, { recursive: true });
    // mkdir succeeded - we're done
    return;
  } catch (_err) {
    // mkdir failed - check if path exists
    let stats;
    try {
      stats = statSync(dirPath);
    } catch {
      // statSync failed - path doesn't exist or is inaccessible
      // Re-throw original mkdir error
      throw new Error(
        `Failed to create directory: ${dirPath}\n` +
          `  ${_err instanceof Error ? _err.message : String(_err)}`,
      );
    }

    // Path exists - check if it's a directory
    if (!stats.isDirectory()) {
      throw new Error(
        `Path exists but is not a directory: ${dirPath}\n` +
          `  Remove the file or choose a different path.`,
      );
    }

    // Path exists and is a directory - this is OK (race condition handled)
    return;
  }
}

/**
 * Checksum tracking for overwrite protection
 */
export interface ChecksumRecord {
  filePath: string;
  checksum: string;
  timestamp: string;
}

/**
 * Atomic file writer with temp + rename pattern
 * Includes rollback support and checksum tracking
 */
export class AtomicFileWriter {
  private checksums: Map<string, ChecksumRecord> = new Map();
  private backups: Map<string, string> = new Map();
  private checksumHandler?: (
    filePath: string,
    lastChecksum: string,
    currentChecksum: string,
    interactive: boolean,
    force: boolean,
  ) => Promise<"overwrite" | "keep" | "abort">;

  /**
   * Set custom checksum mismatch handler (for interactive prompts)
   */
  setChecksumHandler(
    handler: (
      filePath: string,
      lastChecksum: string,
      currentChecksum: string,
      interactive: boolean,
      force: boolean,
    ) => Promise<"overwrite" | "keep" | "abort">,
  ): void {
    this.checksumHandler = handler;
  }

  /**
   * Write content to a file atomically
   * Uses temp file + rename for atomicity
   */
  async write(
    filePath: string,
    content: string,
    options: { interactive?: boolean; force?: boolean } = {},
  ): Promise<void> {
    const { interactive = false, force = false } = options;

    // Ensure parent directory exists
    const dir = dirname(filePath);
    ensureDirectoryExists(dir);

    // Check for manual edits (overwrite protection)
    if (existsSync(filePath) && this.checksums.has(filePath)) {
      const lastChecksum = this.checksums.get(filePath)!.checksum;
      const currentChecksum = computeFileChecksum(filePath);

      if (lastChecksum !== currentChecksum) {
        // Use custom handler if available, otherwise throw
        if (this.checksumHandler) {
          const decision = await this.checksumHandler(
            filePath,
            lastChecksum,
            currentChecksum,
            interactive,
            force,
          );

          if (decision === "keep") {
            // Skip writing this file
            return;
          }

          if (decision === "abort") {
            throw new Error(
              `File has been manually edited: ${filePath}\n` +
                `  Last known checksum: ${lastChecksum.slice(0, 16)}...\n` +
                `  Current checksum:    ${currentChecksum.slice(0, 16)}...\n` +
                `  Sync aborted by user.`,
            );
          }

          // 'overwrite' falls through to normal write
        } else {
          // No handler, throw error (old behavior)
          throw new Error(
            `File has been manually edited: ${filePath}\n` +
              `  Last known checksum: ${lastChecksum.slice(0, 16)}...\n` +
              `  Current checksum:    ${currentChecksum.slice(0, 16)}...\n` +
              `  Use --force to overwrite or resolve conflicts manually.`,
          );
        }
      }
    }

    // Write to temp file with minimal temp directory creation
    // Use the file's parent directory as temp location to avoid cross-device issues
    const dir_name = dirname(filePath);
    const base_name = basename(filePath);
    let backupPath: string | undefined;
    let tempPath: string | undefined;

    try {
      // Create backup only if file exists (lazy backup creation)
      if (existsSync(filePath)) {
        const randomSuffix = randomBytes(8).toString("hex");
        backupPath = join(dir_name, `.${base_name}.backup.${randomSuffix}`);
        try {
          copyFileSync(filePath, backupPath);
          this.backups.set(filePath, backupPath);
        } catch {
          // If backup creation fails, don't block the write
          // Just clear backup path and proceed
          backupPath = undefined;
        }
      }

      // Write to temp file in same directory as target (avoids EXDEV on Windows)
      const randomSuffix = randomBytes(8).toString("hex");
      tempPath = join(dir_name, `.${base_name}.tmp.${randomSuffix}`);

      try {
        writeFileSync(tempPath, content, "utf8");
      } catch (_err) {
        throw new Error(
          `Failed to write temp file: ${tempPath}\n` +
            `  ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      // Atomic rename (same-directory rename is always atomic on all platforms)
      try {
        renameSync(tempPath, filePath);
        tempPath = undefined; // Mark as cleaned up
      } catch (_err) {
        throw new Error(
          `Failed to rename temp file: ${tempPath} → ${filePath}\n` +
            `  ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      // Track checksum
      const checksum = computeContentChecksum(content);
      this.checksums.set(filePath, {
        filePath,
        checksum,
        timestamp: new Date().toISOString(),
      });

      // Clean up backup on success
      if (backupPath && this.backups.has(filePath)) {
        try {
          unlinkSync(backupPath);
        } catch {
          // Ignore cleanup errors
        }
        this.backups.delete(filePath);
      }
    } finally {
      // Clean up temp file on any error
      // Use try/catch instead of existsSync to avoid TOCTOU race condition
      if (tempPath) {
        try {
          unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors (file may not exist or already deleted)
        }
      }

      // Clean up backup on error
      // Use try/catch instead of existsSync to avoid TOCTOU race condition
      if (backupPath) {
        try {
          unlinkSync(backupPath);
        } catch {
          // Ignore cleanup errors (file may not exist or already deleted)
        }
      }
    }
  }

  /**
   * Rollback writes by restoring from backups
   * Silently skips missing backups (race condition safe)
   */
  rollback(): void {
    const errors: string[] = [];

    for (const [filePath, backupPath] of this.backups) {
      try {
        // Check if backup exists before trying to read it
        if (!existsSync(backupPath)) {
          // Backup is missing - this is OK (race condition or cleanup)
          // Just skip this file
          continue;
        }

        const backupContent = readFileSync(backupPath, "utf8");
        writeFileSync(filePath, backupContent, "utf8");
        try {
          unlinkSync(backupPath);
        } catch {
          // Ignore cleanup errors
        }
      } catch (_err) {
        errors.push(
          `  - ${filePath}: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }
    }

    this.backups.clear();

    if (errors.length > 0) {
      throw new Error(
        `Rollback failed for some files:\n${errors.join("\n")}\n` +
          `  Manual intervention may be required.`,
      );
    }
  }

  /**
   * Get checksum record for a file
   */
  getChecksum(filePath: string): ChecksumRecord | undefined {
    return this.checksums.get(filePath);
  }

  /**
   * Track an existing file's checksum
   */
  trackFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Cannot track non-existent file: ${filePath}`);
    }

    const checksum = computeFileChecksum(filePath);
    this.checksums.set(filePath, {
      filePath,
      checksum,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Clear all tracked checksums and backups
   */
  clear(): void {
    this.checksums.clear();
    this.backups.clear();
  }
}
