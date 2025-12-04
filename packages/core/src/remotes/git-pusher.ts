/**
 * Git pusher for remotes
 *
 * Handles cloning, updating, and pushing to remote git repositories.
 * Preserves directory structure when pushing files.
 */

import { join, dirname } from "path";
import { existsSync, mkdirSync, rmSync, readdirSync, cpSync } from "fs";
import simpleGit, { type SimpleGit } from "simple-git";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import type { RemoteDestination } from "../config/types.js";
import type { RemotePushResult } from "./types.js";

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
 * Get cache directory for a remote repository
 */
function getRemoteCacheDir(cwd: string, url: string): string {
  const hash = computeCacheHash(url);
  return join(cwd, ".aligntrue", ".cache", "remotes", hash);
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
 * Push files to a remote repository
 */
export async function pushToRemote(
  config: RemoteDestination,
  files: string[],
  rulesDir: string,
  options: {
    cwd: string;
    remoteId: string;
    dryRun?: boolean;
    force?: boolean;
    message?: string;
    onProgress?: (message: string) => void;
  },
): Promise<RemotePushResult> {
  const { cwd, remoteId, dryRun, force, message, onProgress } = options;
  const branch = config.branch || "main";
  const targetPath = config.path || "";

  const cacheDir = getRemoteCacheDir(cwd, config.url);

  const progress = (msg: string) => {
    if (onProgress) {
      onProgress(`[${remoteId}] ${msg}`);
    }
  };

  try {
    // Ensure cache directory exists
    mkdirSync(dirname(cacheDir), { recursive: true });

    const git: SimpleGit = simpleGit();

    // Track if this is an empty remote (no branches yet)
    let isEmptyRemote = false;

    // Clone or fetch the repository
    if (!existsSync(cacheDir)) {
      progress(`Cloning ${config.url}...`);
      try {
        await git.clone(config.url, cacheDir, [
          "--branch",
          branch,
          "--single-branch",
          "--depth",
          "1",
        ]);
      } catch (cloneErr) {
        const errMsg =
          cloneErr instanceof Error ? cloneErr.message : String(cloneErr);
        // Check if this is an empty repository (no branches)
        if (
          errMsg.includes("Remote branch") &&
          errMsg.includes("not found in upstream")
        ) {
          progress(`Remote repository is empty, initializing...`);
          isEmptyRemote = true;
          // Initialize a new repo and set up remote
          mkdirSync(cacheDir, { recursive: true });
          const initGit = simpleGit(cacheDir);
          await initGit.init();
          await initGit.addRemote("origin", config.url);
          // Create initial branch
          await initGit.checkout(["-b", branch]);
        } else {
          throw cloneErr;
        }
      }
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
        try {
          await git.clone(config.url, cacheDir, [
            "--branch",
            branch,
            "--single-branch",
            "--depth",
            "1",
          ]);
        } catch (cloneErr) {
          const errMsg =
            cloneErr instanceof Error ? cloneErr.message : String(cloneErr);
          // Check if this is an empty repository (no branches)
          if (
            errMsg.includes("Remote branch") &&
            errMsg.includes("not found in upstream")
          ) {
            progress(`Remote repository is empty, initializing...`);
            isEmptyRemote = true;
            mkdirSync(cacheDir, { recursive: true });
            const initGit = simpleGit(cacheDir);
            await initGit.init();
            await initGit.addRemote("origin", config.url);
            await initGit.checkout(["-b", branch]);
          } else {
            throw cloneErr;
          }
        }
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
        remoteId,
        success: true,
        filesCount: files.length,
        skipped: true,
        skipReason: "No changes detected",
      };
    }

    if (dryRun) {
      progress(`[DRY RUN] Would push ${files.length} files`);
      return {
        remoteId,
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
      message || `Sync from AlignTrue (${new Date().toISOString()})`;
    progress(`Committing changes...`);
    await repoGit.commit(commitMessage);

    // Get commit SHA
    const log = await repoGit.log({ maxCount: 1 });
    const commitSha = log.latest?.hash;

    // Push (use --set-upstream for empty remotes)
    progress(`Pushing to ${branch}...`);
    if (isEmptyRemote) {
      await repoGit.push(["--set-upstream", "origin", branch]);
    } else {
      await repoGit.push("origin", branch);
    }

    progress(`Successfully pushed ${files.length} files`);
    return {
      remoteId,
      success: true,
      filesCount: files.length,
      ...(commitSha && { commitSha }),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    progress(`Failed: ${error}`);
    return {
      remoteId,
      success: false,
      filesCount: 0,
      error,
    };
  }
}

/**
 * Get the last commit info for a remote cache
 */
export async function getLastRemoteInfo(
  cwd: string,
  url: string,
): Promise<{ sha: string; timestamp: string } | null> {
  const cacheDir = getRemoteCacheDir(cwd, url);

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
 * Clean remote cache for a specific URL
 */
export function cleanRemoteCache(cwd: string, url: string): void {
  const cacheDir = getRemoteCacheDir(cwd, url);
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

/**
 * Clean all remote caches
 */
export function cleanAllRemoteCaches(cwd: string): void {
  const cacheDir = join(cwd, ".aligntrue", ".cache", "remotes");
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}
