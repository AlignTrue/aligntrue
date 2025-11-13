/**
 * Backup manager for AlignTrue configuration and rules
 *
 * Handles creating, restoring, listing, and cleaning up backups
 * of the .aligntrue/ directory.
 */

import { join, dirname, relative } from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
  statSync,
} from "fs";
import micromatch from "micromatch";
import type {
  BackupManifest,
  BackupInfo,
  BackupOptions,
  RestoreOptions,
  CleanupOptions,
} from "./types";

const BACKUP_VERSION = "1";

export class BackupManager {
  /**
   * Create a backup of the .aligntrue/ directory and optionally agent files
   */
  static createBackup(options: BackupOptions = {}): BackupInfo {
    const cwd = options.cwd || process.cwd();
    const aligntrueDir = join(cwd, ".aligntrue");

    if (!existsSync(aligntrueDir)) {
      throw new Error(`AlignTrue directory not found: ${aligntrueDir}`);
    }

    // Create backups directory if it doesn't exist
    const backupsDir = join(aligntrueDir, ".backups");
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }

    // Generate timestamp for this backup (with milliseconds for uniqueness)
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-")
      .replace(/Z$/, "");
    const backupDir = join(backupsDir, timestamp);

    // Create backup directory
    mkdirSync(backupDir, { recursive: true });

    // Collect files to backup (everything except .backups/)
    const files: string[] = [];
    const collectFiles = (dir: string, base: string = "") => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = base ? join(base, entry.name) : entry.name;

        // Skip .backups directory
        if (relativePath === ".backups") continue;

        if (entry.isDirectory()) {
          collectFiles(fullPath, relativePath);
        } else {
          // Normalize to forward slashes for cross-platform consistency
          files.push(relativePath.replace(/\\/g, "/"));
        }
      }
    };
    collectFiles(aligntrueDir);

    // Copy files to backup directory
    for (const file of files) {
      const srcPath = join(aligntrueDir, file);
      const destPath = join(backupDir, file);
      const destDir = dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      cpSync(srcPath, destPath);
    }

    // Backup agent files if requested (default: true)
    const agentFiles: string[] = [];
    const includeAgentFiles = options.includeAgentFiles !== false;

    if (includeAgentFiles && options.editSource) {
      // Create agent-files subdirectory in backup
      const agentFilesDir = join(backupDir, "agent-files");
      mkdirSync(agentFilesDir, { recursive: true });

      // Resolve patterns from edit_source
      const patterns = Array.isArray(options.editSource)
        ? options.editSource
        : [options.editSource];

      // Find all matching agent files
      const agentFilePaths = new Set<string>();

      for (const pattern of patterns) {
        // Expand glob patterns to find matching files
        if (pattern.includes("*")) {
          // Handle glob patterns like ".cursor/rules/*.mdc"
          const parts = pattern.split("/");
          let searchDir = cwd;

          // Navigate to the directory containing the glob
          for (let i = 0; i < parts.length - 1; i++) {
            if (!parts[i]!.includes("*")) {
              searchDir = join(searchDir, parts[i]!);
            } else {
              break;
            }
          }

          if (existsSync(searchDir)) {
            try {
              const entries = readdirSync(searchDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isFile()) {
                  const filePath = join(searchDir, entry.name);
                  const relativePath = relative(cwd, filePath).replace(
                    /\\/g,
                    "/",
                  );
                  if (micromatch.isMatch(relativePath, pattern)) {
                    agentFilePaths.add(relativePath);
                  }
                }
              }
            } catch {
              // Directory not readable, skip
            }
          }
        } else {
          // Direct file path (e.g., "AGENTS.md")
          const filePath = join(cwd, pattern);
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            agentFilePaths.add(pattern);
          }
        }
      }

      // Copy agent files to backup
      for (const agentFile of agentFilePaths) {
        const srcPath = join(cwd, agentFile);
        const destPath = join(agentFilesDir, agentFile);
        const destDir = dirname(destPath);

        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }

        try {
          cpSync(srcPath, destPath);
          agentFiles.push(agentFile);
        } catch {
          // File not readable or doesn't exist, skip
        }
      }
    }

    // Create manifest
    const manifest: BackupManifest = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      files,
      created_by: options.created_by || "manual",
      ...(options.notes && { notes: options.notes }),
      ...(options.action && { action: options.action }),
      ...(options.mode && { mode: options.mode }),
      ...(options.scopes && { scopes: options.scopes }),
      ...(agentFiles.length > 0 && { agent_files: agentFiles }),
    };

    writeFileSync(
      join(backupDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );

    return {
      timestamp,
      path: backupDir,
      manifest,
    };
  }

  /**
   * List files in a specific backup
   */
  static listBackupFiles(
    timestamp: string,
    options: { cwd?: string } = {},
  ): string[] {
    const cwd = options.cwd || process.cwd();
    const backupDir = join(cwd, ".aligntrue", ".backups", timestamp);
    const manifestPath = join(backupDir, "manifest.json");

    if (!existsSync(manifestPath)) {
      throw new Error(`Backup not found: ${timestamp}`);
    }

    try {
      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf-8"),
      ) as BackupManifest;
      return manifest.files;
    } catch (err) {
      throw new Error(
        `Failed to read backup manifest: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Read a specific file from a backup
   */
  static readBackupFile(
    timestamp: string,
    filePath: string,
    options: { cwd?: string } = {},
  ): string | null {
    const cwd = options.cwd || process.cwd();
    const backupDir = join(cwd, ".aligntrue", ".backups", timestamp);
    const backupFilePath = join(backupDir, filePath);

    if (!existsSync(backupFilePath)) {
      return null;
    }

    try {
      return readFileSync(backupFilePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * List all available backups
   */
  static listBackups(cwd: string = process.cwd()): BackupInfo[] {
    const backupsDir = join(cwd, ".aligntrue", ".backups");

    if (!existsSync(backupsDir)) {
      return [];
    }

    const entries = readdirSync(backupsDir, { withFileTypes: true });
    const backups: BackupInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const backupDir = join(backupsDir, entry.name);
      const manifestPath = join(backupDir, "manifest.json");

      if (!existsSync(manifestPath)) continue;

      try {
        const manifest = JSON.parse(
          readFileSync(manifestPath, "utf-8"),
        ) as BackupManifest;
        backups.push({
          timestamp: entry.name,
          path: backupDir,
          manifest,
        });
      } catch {
        // Skip invalid manifests
        continue;
      }
    }

    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Restore a backup
   */
  static restoreBackup(options: RestoreOptions = {}): BackupInfo {
    const cwd = options.cwd || process.cwd();
    const backups = this.listBackups(cwd);

    if (backups.length === 0) {
      throw new Error("No backups found");
    }

    // Find backup to restore
    let backup: BackupInfo;
    if (options.timestamp) {
      const found = backups.find((b) => b.timestamp === options.timestamp);
      if (!found) {
        throw new Error(`Backup not found: ${options.timestamp}`);
      }
      backup = found;
    } else {
      const mostRecent = backups[0];
      if (!mostRecent) {
        throw new Error("No backups found");
      }
      backup = mostRecent;
    }

    const aligntrueDir = join(cwd, ".aligntrue");

    // Validate backup directory exists
    if (!existsSync(backup.path)) {
      throw new Error(`Backup directory not found: ${backup.path}`);
    }

    // Create temporary backup of current state
    const tempBackup = this.createBackup({
      cwd,
      created_by: "restore-temp",
      notes: "Temporary backup before restore",
    });

    try {
      // Determine which files to restore
      const filesToRestore = options.files || backup.manifest.files;

      // Validate requested files exist in backup
      if (options.files) {
        for (const file of options.files) {
          if (!backup.manifest.files.includes(file)) {
            throw new Error(`File not found in backup: ${file}`);
          }
        }
      }

      // First, remove existing files that are being restored
      for (const file of filesToRestore) {
        const destPath = join(aligntrueDir, file);
        if (existsSync(destPath)) {
          rmSync(destPath, { force: true });
        }
      }

      // Restore files (excluding .backups directory)
      for (const file of filesToRestore) {
        const srcPath = join(backup.path, file);
        const destPath = join(aligntrueDir, file);
        const destDir = dirname(destPath);

        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }

        cpSync(srcPath, destPath);
      }

      // Restore agent files if present in backup
      if (
        backup.manifest.agent_files &&
        backup.manifest.agent_files.length > 0
      ) {
        const agentFilesDir = join(backup.path, "agent-files");

        if (existsSync(agentFilesDir)) {
          for (const agentFile of backup.manifest.agent_files) {
            const srcPath = join(agentFilesDir, agentFile);
            const destPath = join(cwd, agentFile);

            // Skip if file doesn't exist in backup (safety check)
            if (!existsSync(srcPath)) {
              continue;
            }

            const destDir = dirname(destPath);
            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true });
            }

            try {
              cpSync(srcPath, destPath);
            } catch {
              // Log but don't fail entire restore if one agent file fails
              console.warn(
                `Warning: Failed to restore agent file: ${agentFile}`,
              );
            }
          }
        }
      }

      // Clean up temp backup on success
      rmSync(tempBackup.path, { recursive: true, force: true });

      return backup;
    } catch (_error) {
      // Restore from temp backup on failure
      for (const file of tempBackup.manifest.files) {
        const srcPath = join(tempBackup.path, file);
        const destPath = join(aligntrueDir, file);
        cpSync(srcPath, destPath);
      }

      // Clean up temp backup
      rmSync(tempBackup.path, { recursive: true, force: true });

      throw new Error(
        `Restore failed: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Clean up old backups, keeping the most recent N
   */
  static cleanupOldBackups(options: CleanupOptions = {}): number {
    const cwd = options.cwd || process.cwd();
    const keepCount = options.keepCount ?? 20;

    const backups = this.listBackups(cwd);

    if (backups.length <= keepCount) {
      return 0;
    }

    // Remove oldest backups
    const toRemove = backups.slice(keepCount);
    let removed = 0;

    for (const backup of toRemove) {
      try {
        rmSync(backup.path, { recursive: true, force: true });
        removed++;
      } catch {
        // Continue on error
      }
    }

    return removed;
  }

  /**
   * Get a specific backup by timestamp
   */
  static getBackup(cwd: string, timestamp: string): BackupInfo | undefined {
    return this.listBackups(cwd).find((b) => b.timestamp === timestamp);
  }

  /**
   * Delete a specific backup
   */
  static deleteBackup(cwd: string, timestamp: string): boolean {
    const backup = this.getBackup(cwd, timestamp);
    if (!backup) {
      return false;
    }

    try {
      rmSync(backup.path, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a scope-specific backup
   * Stores in .aligntrue/.backups/<scope>/<timestamp>/
   */
  static createScopedBackup(
    scope: string,
    options: BackupOptions = {},
  ): BackupInfo {
    const cwd = options.cwd || process.cwd();
    const aligntrueDir = join(cwd, ".aligntrue");

    if (!existsSync(aligntrueDir)) {
      throw new Error(`AlignTrue directory not found: ${aligntrueDir}`);
    }

    // Create scope-specific backups directory
    const backupsDir = join(aligntrueDir, ".backups", scope);
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }

    // Generate timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-")
      .replace(/Z$/, "");
    const backupDir = join(backupsDir, timestamp);

    mkdirSync(backupDir, { recursive: true });

    // Collect files for this scope
    // For now, backup the entire .aligntrue directory
    // TODO: Filter by scope
    const files: string[] = [];
    const collectFiles = (dir: string, base: string = "") => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = base ? join(base, entry.name) : entry.name;

        if (relativePath === ".backups") continue;

        if (entry.isDirectory()) {
          collectFiles(fullPath, relativePath);
        } else {
          files.push(relativePath.replace(/\\/g, "/"));
        }
      }
    };
    collectFiles(aligntrueDir);

    // Copy files
    for (const file of files) {
      const srcPath = join(aligntrueDir, file);
      const destPath = join(backupDir, file);
      const destDir = dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      cpSync(srcPath, destPath);
    }

    // Create manifest
    const manifest: BackupManifest = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      files,
      created_by: options.created_by || "manual",
      ...(options.notes && { notes: options.notes }),
      ...(options.action && { action: options.action }),
      ...(options.mode && { mode: options.mode }),
      ...(options.scopes && { scopes: options.scopes }),
    };

    writeFileSync(
      join(backupDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );

    return {
      timestamp,
      path: backupDir,
      manifest,
    };
  }

  /**
   * Sync backup to remote storage
   * TODO: Implement git push to remote backup repository
   */
  static async syncBackupToRemote(
    _backup: BackupInfo,
    _remoteUrl: string,
  ): Promise<void> {
    // TODO: Implement git push
    // For now, this is a no-op
  }
}
