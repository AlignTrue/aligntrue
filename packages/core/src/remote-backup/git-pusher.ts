/**
 * Git pusher for remote backups
 *
 * Handles cloning, updating, and pushing to remote git repositories.
 * Preserves directory structure when pushing files.
 */

import { join, dirname } from "path";
import { existsSync, mkdirSync, rmSync, readdirSync, cpSync } from "fs";
import simpleGit, { type SimpleGit } from "simple-git";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import type { RemoteBackupDestination, BackupPushResult } from "./types.js";

/**
 * Compute a short hash for cache directory naming
 */
function computeCacheHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 12);
}

/**
 * Get cache directory for a backup repository
 */
function getBackupCacheDir(cwd: string, url: string): string {
  const hash = computeCacheHash(url);
  return join(cwd, ".aligntrue", ".cache", "backup", hash);
}

/**
 * Clean directory contents but keep the directory
 */
function cleanDirectory(dir: string, keepFiles: string[] = []): void {
  if (!existsSync(dir)) return;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip files/dirs that should be kept
    if (keepFiles.includes(entry.name)) continue;

    if (entry.isDirectory()) {
      rmSync(fullPath, { recursive: true, force: true });
    } else {
      rmSync(fullPath, { force: true });
    }
  }
}

/**
 * Push files to a remote backup repository
 */
export async function pushToBackup(
  config: RemoteBackupDestination,
  files: string[],
  rulesDir: string,
  options: {
    cwd: string;
    backupId: string;
    dryRun?: boolean;
    force?: boolean;
    message?: string;
    onProgress?: (message: string) => void;
  },
): Promise<BackupPushResult> {
  const { cwd, backupId, dryRun, force, message, onProgress } = options;
  const branch = config.branch || "main";
  const targetPath = config.path || "";

  const cacheDir = getBackupCacheDir(cwd, config.url);

  const progress = (msg: string) => {
    if (onProgress) {
      onProgress(`[${backupId}] ${msg}`);
    }
  };

  try {
    // Ensure cache directory exists
    mkdirSync(dirname(cacheDir), { recursive: true });

    const git: SimpleGit = simpleGit();

    // Clone or fetch the repository
    if (!existsSync(cacheDir)) {
      progress(`Cloning ${config.url}...`);
      await git.clone(config.url, cacheDir, [
        "--branch",
        branch,
        "--single-branch",
        "--depth",
        "1",
      ]);
    } else {
      progress(`Fetching updates...`);
      const repoGit = simpleGit(cacheDir);
      try {
        await repoGit.fetch(["origin", branch]);
        await repoGit.reset(["--hard", `origin/${branch}`]);
      } catch {
        // If fetch fails, try re-cloning
        progress(`Re-cloning repository...`);
        rmSync(cacheDir, { recursive: true, force: true });
        await git.clone(config.url, cacheDir, [
          "--branch",
          branch,
          "--single-branch",
          "--depth",
          "1",
        ]);
      }
    }

    const repoGit = simpleGit(cacheDir);

    // Determine target directory in repo
    const targetDir = targetPath ? join(cacheDir, targetPath) : cacheDir;

    // Ensure target directory exists, then clean it (except .git)
    ensureDirectoryExists(targetDir);
    cleanDirectory(targetDir, [".git"]);

    // Copy files preserving structure
    progress(`Copying ${files.length} files...`);
    for (const file of files) {
      const srcPath = join(rulesDir, file);
      const destPath = join(targetDir, file);

      if (!existsSync(srcPath)) {
        continue;
      }

      // Ensure destination directory exists
      mkdirSync(dirname(destPath), { recursive: true });

      // Copy file
      cpSync(srcPath, destPath);
    }

    // Check for changes
    const status = await repoGit.status();
    const hasChanges =
      status.modified.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.not_added.length > 0;

    if (!hasChanges && !force) {
      progress(`No changes to push`);
      return {
        backupId,
        success: true,
        filesCount: files.length,
        skipped: true,
        skipReason: "No changes detected",
      };
    }

    if (dryRun) {
      progress(`[DRY RUN] Would push ${files.length} files`);
      return {
        backupId,
        success: true,
        filesCount: files.length,
        skipped: true,
        skipReason: "Dry run",
      };
    }

    // Stage all changes
    await repoGit.add(".");

    // Commit
    const commitMessage =
      message || `Backup from AlignTrue (${new Date().toISOString()})`;
    progress(`Committing changes...`);
    await repoGit.commit(commitMessage);

    // Get commit SHA
    const log = await repoGit.log({ maxCount: 1 });
    const commitSha = log.latest?.hash;

    // Push
    progress(`Pushing to ${branch}...`);
    await repoGit.push("origin", branch);

    progress(`Successfully pushed ${files.length} files`);
    return {
      backupId,
      success: true,
      filesCount: files.length,
      ...(commitSha && { commitSha }),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    progress(`Failed: ${error}`);
    return {
      backupId,
      success: false,
      filesCount: 0,
      error,
    };
  }
}

/**
 * Get the last commit info for a backup cache
 */
export async function getLastBackupInfo(
  cwd: string,
  url: string,
): Promise<{ sha: string; timestamp: string } | null> {
  const cacheDir = getBackupCacheDir(cwd, url);

  if (!existsSync(cacheDir)) {
    return null;
  }

  try {
    const git = simpleGit(cacheDir);
    const log = await git.log({ maxCount: 1 });

    if (log.latest) {
      return {
        sha: log.latest.hash,
        timestamp: log.latest.date,
      };
    }
  } catch {
    // Cache corrupted or not a git repo
  }

  return null;
}

/**
 * Clean backup cache for a specific URL
 */
export function cleanBackupCache(cwd: string, url: string): void {
  const cacheDir = getBackupCacheDir(cwd, url);
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

/**
 * Clean all backup caches
 */
export function cleanAllBackupCaches(cwd: string): void {
  const cacheDir = join(cwd, ".aligntrue", ".cache", "backup");
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}
