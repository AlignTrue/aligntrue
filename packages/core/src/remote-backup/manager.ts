/**
 * Remote backup manager for AlignTrue
 *
 * Coordinates backing up local rules to remote git repositories.
 * Supports multiple backup destinations with file assignment.
 */

import { join } from "path";
import type {
  RemoteBackupConfig,
  RemoteBackupResult,
  RemoteBackupOptions,
  RemoteBackupStatus,
  BackupPushResult,
} from "./types.js";
import { resolveFileAssignments, getBackupStatus } from "./file-resolver.js";
import { pushToBackup, getLastBackupInfo } from "./git-pusher.js";

/**
 * Remote backup manager
 */
export class RemoteBackupManager {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private config: RemoteBackupConfig;
  private cwd: string;
  private rulesDir: string;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    config: RemoteBackupConfig,
    options: { cwd?: string; rulesDir?: string } = {},
  ) {
    this.config = config;
    this.cwd = options.cwd || process.cwd();
    this.rulesDir = options.rulesDir || join(this.cwd, ".aligntrue", "rules");
  }

  /**
   * Check if remote backup is configured
   */
  isConfigured(): boolean {
    return !!(this.config.default || this.config.additional?.length);
  }

  /**
   * Check if auto-backup is enabled
   * Returns true if any backup has auto: true (default)
   */
  isAutoEnabled(): boolean {
    if (this.config.default?.auto !== false) {
      return true;
    }
    if (this.config.additional?.some((a) => a.auto !== false)) {
      return true;
    }
    return false;
  }

  /**
   * Push rules to all configured backup destinations
   */
  async push(options: RemoteBackupOptions = {}): Promise<RemoteBackupResult> {
    const cwd = options.cwd || this.cwd;
    const sourceUrls = options.sourceUrls || [];
    const onProgress = options.onProgress;

    // Resolve file assignments
    const { assignments, warnings } = resolveFileAssignments(
      this.config,
      this.rulesDir,
      sourceUrls,
    );

    const results: BackupPushResult[] = [];
    let totalFiles = 0;

    // Push to each backup destination
    for (const assignment of assignments) {
      // Auto check is handled at workflow level (sync command checks isAutoEnabled)
      // For manual push, always proceed

      const result = await pushToBackup(
        assignment.config,
        assignment.files,
        this.rulesDir,
        {
          cwd,
          backupId: assignment.backupId,
          ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
          ...(options.force !== undefined && { force: options.force }),
          ...(options.message !== undefined && { message: options.message }),
          ...(onProgress && { onProgress }),
        },
      );

      results.push(result);

      if (result.success && !result.skipped) {
        totalFiles += result.filesCount;
      }
    }

    // Add skipped backups for source/backup conflicts
    const skippedUrls = new Set(
      warnings
        .filter((w) => w.type === "source-backup-conflict")
        .map((w) => w.url),
    );

    if (this.config.default && skippedUrls.has(this.config.default.url)) {
      results.push({
        backupId: "default",
        success: true,
        filesCount: 0,
        skipped: true,
        skipReason: "URL is also configured as a source",
      });
    }

    if (this.config.additional) {
      for (const additional of this.config.additional) {
        if (skippedUrls.has(additional.url)) {
          results.push({
            backupId: additional.id,
            success: true,
            filesCount: 0,
            skipped: true,
            skipReason: "URL is also configured as a source",
          });
        }
      }
    }

    // Determine overall success
    const success = results.every((r) => r.success);

    return {
      results,
      success,
      totalFiles,
      warnings,
    };
  }

  /**
   * Push only backups that have auto enabled
   */
  async autoPush(
    options: RemoteBackupOptions = {},
  ): Promise<RemoteBackupResult> {
    const cwd = options.cwd || this.cwd;
    const sourceUrls = options.sourceUrls || [];
    const onProgress = options.onProgress;

    // Resolve file assignments
    const { assignments, warnings } = resolveFileAssignments(
      this.config,
      this.rulesDir,
      sourceUrls,
    );

    const results: BackupPushResult[] = [];
    let totalFiles = 0;

    // Push to each backup destination that has auto enabled
    for (const assignment of assignments) {
      // Check if auto is enabled for this backup
      const isAuto =
        assignment.backupId === "default"
          ? this.config.default?.auto !== false
          : this.config.additional?.find((a) => a.id === assignment.backupId)
              ?.auto !== false;

      if (!isAuto) {
        results.push({
          backupId: assignment.backupId,
          success: true,
          filesCount: 0,
          skipped: true,
          skipReason: "Auto backup disabled",
        });
        continue;
      }

      const result = await pushToBackup(
        assignment.config,
        assignment.files,
        this.rulesDir,
        {
          cwd,
          backupId: assignment.backupId,
          ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
          ...(options.force !== undefined && { force: options.force }),
          ...(options.message !== undefined && { message: options.message }),
          ...(onProgress && { onProgress }),
        },
      );

      results.push(result);

      if (result.success && !result.skipped) {
        totalFiles += result.filesCount;
      }
    }

    // Determine overall success
    const success = results.every((r) => r.success);

    return {
      results,
      success,
      totalFiles,
      warnings,
    };
  }

  /**
   * Get status of all configured backups
   */
  async getStatus(sourceUrls: string[] = []): Promise<RemoteBackupStatus[]> {
    const { backups } = getBackupStatus(this.config, this.rulesDir, sourceUrls);

    const statuses: RemoteBackupStatus[] = [];

    for (const backup of backups) {
      const lastInfo = await getLastBackupInfo(this.cwd, backup.url);

      statuses.push({
        backupId: backup.id,
        url: backup.url,
        branch: backup.branch,
        files: backup.files,
        ...(lastInfo?.timestamp && { lastPush: lastInfo.timestamp }),
        ...(lastInfo?.sha && { lastCommit: lastInfo.sha }),
        neverPushed: !lastInfo,
      });
    }

    return statuses;
  }

  /**
   * Format a human-readable status summary
   */
  async formatStatusSummary(sourceUrls: string[] = []): Promise<string> {
    const statuses = await this.getStatus(sourceUrls);

    if (statuses.length === 0) {
      return "No remote backups configured.";
    }

    const lines: string[] = ["Backup Configuration:"];

    for (const status of statuses) {
      const filesCount = status.files.length;
      const name = status.backupId === "default" ? "default" : status.backupId;
      lines.push(`  ${name}: ${status.url} (${filesCount} files)`);

      // Show files for additional backups
      if (status.backupId !== "default" && filesCount <= 10) {
        for (const file of status.files) {
          lines.push(`    - ${file}`);
        }
      } else if (status.backupId !== "default") {
        for (const file of status.files.slice(0, 5)) {
          lines.push(`    - ${file}`);
        }
        lines.push(`    ... and ${filesCount - 5} more`);
      }
    }

    // Show last push info for default
    const defaultStatus = statuses.find((s) => s.backupId === "default");
    if (defaultStatus) {
      if (defaultStatus.lastPush) {
        const ago = formatTimeAgo(new Date(defaultStatus.lastPush));
        lines.push(`\nLast push: ${ago}`);
      } else if (defaultStatus.neverPushed) {
        lines.push(`\nNever pushed (run 'aligntrue backup push' to push)`);
      }
    }

    return lines.join("\n");
  }
}

/**
 * Format a date as a relative time string
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/**
 * Create a remote backup manager from config
 */
export function createRemoteBackupManager(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  config: RemoteBackupConfig,
  options: { cwd?: string; rulesDir?: string } = {},
): RemoteBackupManager {
  return new RemoteBackupManager(config, options);
}
