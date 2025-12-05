/**
 * Remotes manager for AlignTrue
 *
 * Coordinates syncing local rules to remote git repositories
 * using scope-based and pattern-based routing.
 */

import { join } from "path";
import type { RemotesConfig } from "../config/types.js";
import type {
  RemotesSyncResult,
  RemotesOptions,
  RemoteStatus,
  RemotePushResult,
} from "./types.js";
import {
  resolveFileAssignments,
  getRemotesStatus,
  type FileResolutionOptions,
} from "./file-resolver.js";
import { pushToRemote, getLastRemoteInfo } from "./git-pusher.js";

/**
 * Remotes manager
 */
export class RemotesManager {
  private config: RemotesConfig;
  private cwd: string;
  private rulesDir: string;
  private mode: "solo" | "team" | "enterprise";

  constructor(
    config: RemotesConfig,
    options: {
      cwd?: string;
      rulesDir?: string;
      mode?: "solo" | "team" | "enterprise";
    } = {},
  ) {
    this.config = config;
    this.cwd = options.cwd || process.cwd();
    this.rulesDir = options.rulesDir || join(this.cwd, ".aligntrue", "rules");
    this.mode = options.mode || "solo";
  }

  /**
   * Get file resolution options including mode
   */
  private getResolutionOptions(): FileResolutionOptions {
    return { mode: this.mode };
  }

  /**
   * Check if any remotes are configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.personal ||
      this.config.shared ||
      this.config.custom?.length
    );
  }

  /**
   * Check if auto-sync is enabled
   * Returns true if any remote has auto: true (default)
   */
  isAutoEnabled(): boolean {
    // Check personal remote
    if (this.config.personal) {
      const dest =
        typeof this.config.personal === "string"
          ? { url: this.config.personal }
          : this.config.personal;
      if (dest.auto !== false) return true;
    }

    // Check shared remote
    if (this.config.shared) {
      const dest =
        typeof this.config.shared === "string"
          ? { url: this.config.shared }
          : this.config.shared;
      if (dest.auto !== false) return true;
    }

    // Check custom remotes
    if (this.config.custom?.some((c) => c.auto !== false)) {
      return true;
    }

    return false;
  }

  /**
   * Sync rules to all configured remotes
   */
  async sync(options: RemotesOptions = {}): Promise<RemotesSyncResult> {
    const cwd = options.cwd || this.cwd;
    const sourceUrls = options.sourceUrls || [];
    const onProgress = options.onProgress;

    // Resolve file assignments with mode-aware routing
    const { assignments, warnings, diagnostics } = resolveFileAssignments(
      this.config,
      this.rulesDir,
      sourceUrls,
      this.getResolutionOptions(),
    );

    const results: RemotePushResult[] = [];
    let totalFiles = 0;

    // Push to each remote destination
    for (const assignment of assignments) {
      const result = await pushToRemote(
        assignment.config,
        assignment.files,
        this.rulesDir,
        {
          cwd,
          remoteId: assignment.remoteId,
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

    const result: RemotesSyncResult = {
      results,
      success,
      totalFiles,
      warnings,
    };

    if (diagnostics !== undefined) {
      result.diagnostics = diagnostics;
    }

    return result;
  }

  /**
   * Sync only remotes that have auto enabled
   */
  async autoSync(options: RemotesOptions = {}): Promise<RemotesSyncResult> {
    const cwd = options.cwd || this.cwd;
    const sourceUrls = options.sourceUrls || [];
    const onProgress = options.onProgress;

    // Resolve file assignments with mode-aware routing
    const { assignments, warnings, diagnostics } = resolveFileAssignments(
      this.config,
      this.rulesDir,
      sourceUrls,
      this.getResolutionOptions(),
    );

    const results: RemotePushResult[] = [];
    let totalFiles = 0;

    // Push to each remote destination that has auto enabled
    for (const assignment of assignments) {
      // Check if auto is enabled for this remote
      const isAuto = this.isRemoteAutoEnabled(assignment.remoteId);

      if (!isAuto) {
        results.push({
          remoteId: assignment.remoteId,
          success: true,
          filesCount: 0,
          skipped: true,
          skipReason: "Auto sync disabled",
        });
        continue;
      }

      const result = await pushToRemote(
        assignment.config,
        assignment.files,
        this.rulesDir,
        {
          cwd,
          remoteId: assignment.remoteId,
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

    const result: RemotesSyncResult = {
      results,
      success,
      totalFiles,
      warnings,
    };

    if (diagnostics !== undefined) {
      result.diagnostics = diagnostics;
    }

    return result;
  }

  /**
   * Check if a specific remote has auto enabled
   */
  private isRemoteAutoEnabled(remoteId: string): boolean {
    if (remoteId === "personal" && this.config.personal) {
      const dest =
        typeof this.config.personal === "string"
          ? { url: this.config.personal }
          : this.config.personal;
      return dest.auto !== false;
    }

    if (remoteId === "shared" && this.config.shared) {
      const dest =
        typeof this.config.shared === "string"
          ? { url: this.config.shared }
          : this.config.shared;
      return dest.auto !== false;
    }

    const custom = this.config.custom?.find((c) => c.id === remoteId);
    if (custom) {
      return custom.auto !== false;
    }

    return true; // Default to enabled
  }

  /**
   * Get status of all configured remotes
   */
  async getStatus(sourceUrls: string[] = []): Promise<RemoteStatus[]> {
    const { remotes } = getRemotesStatus(
      this.config,
      this.rulesDir,
      sourceUrls,
      this.getResolutionOptions(),
    );

    const statuses: RemoteStatus[] = [];

    for (const remote of remotes) {
      const lastInfo = await getLastRemoteInfo(this.cwd, remote.url);

      statuses.push({
        remoteId: remote.id,
        url: remote.url,
        branch: remote.branch,
        files: remote.files,
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
      return "No remotes configured.";
    }

    const lines: string[] = ["Remotes Configuration:"];

    for (const status of statuses) {
      const filesCount = status.files.length;
      lines.push(`  ${status.remoteId}: ${status.url} (${filesCount} files)`);

      // Show files for remotes with few files
      if (filesCount <= 10) {
        for (const file of status.files) {
          lines.push(`    - ${file}`);
        }
      } else {
        for (const file of status.files.slice(0, 5)) {
          lines.push(`    - ${file}`);
        }
        lines.push(`    ... and ${filesCount - 5} more`);
      }

      // Show last push info
      if (status.lastPush) {
        const ago = formatTimeAgo(new Date(status.lastPush));
        lines.push(`    Last push: ${ago}`);
      } else if (status.neverPushed) {
        lines.push(`    Never pushed`);
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
 * Create a remotes manager from config
 */
export function createRemotesManager(
  config: RemotesConfig,
  options: {
    cwd?: string;
    rulesDir?: string;
    mode?: "solo" | "team" | "enterprise";
  } = {},
): RemotesManager {
  return new RemotesManager(config, options);
}
