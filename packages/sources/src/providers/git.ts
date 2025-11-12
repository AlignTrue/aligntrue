/**
 * Git source provider - clones rules from any git repository
 *
 * Strategy:
 * - Clones repository to .aligntrue/.cache/git/<repo-hash>/
 * - Uses shallow clone (--depth 1) for speed and space
 * - Smart caching with TTL based on ref type (branches check daily, tags weekly, commits never)
 * - Falls back to cache when network unavailable
 * - Supports https and ssh URLs, branch/tag/commit refs
 *
 * Privacy:
 * - Requires user consent before first git clone
 * - Respects offline mode (uses cache only, no network)
 * - Clear error messages when consent denied
 */

import { readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import simpleGit, { SimpleGit, GitError } from "simple-git";
import type { SourceProvider } from "./index.js";
import type { ConsentManager } from "@aligntrue/core";
import { checkFileSize, createIgnoreFilter } from "@aligntrue/core/performance";
import {
  detectRefType,
  loadCacheMeta,
  saveCacheMeta,
  shouldCheckForUpdates,
  getUpdateStrategy,
  type CacheMeta,
} from "./cache-meta.js";
import { UpdatesAvailableError } from "./errors.js";

/**
 * Git source configuration
 */
export interface GitSourceConfig {
  type: "git";
  url: string; // https:// or git@github.com: format
  ref?: string; // branch/tag/commit (default: 'main')
  path?: string; // path to rules file in repo (default: '.aligntrue.yaml')
  forceRefresh?: boolean; // bypass cache
  checkInterval?: number; // override default check interval (seconds)
}

/**
 * Git provider options
 */
export interface GitProviderOptions {
  cacheDir: string;
  url: string;
  ref: string;
  path: string;
  forceRefresh: boolean;
  checkInterval: number;
  offlineMode?: boolean;
  consentManager?: ConsentManager;
}

/**
 * Git provider implementation
 */
export class GitProvider implements SourceProvider {
  type = "git" as const;
  private cacheDir: string;
  private url: string;
  private ref: string;
  private path: string;
  private forceRefresh: boolean;
  private checkInterval: number;
  private repoHash: string;
  private repoDir: string;
  private offlineMode: boolean;
  private consentManager?: ConsentManager;
  private mode: "solo" | "team" | "enterprise";
  private maxFileSizeMb: number;
  private force: boolean;

  constructor(
    config: GitSourceConfig,
    baseCacheDir: string = ".aligntrue/.cache/git",
    options?: {
      offlineMode?: boolean;
      consentManager?: ConsentManager;
      mode?: "solo" | "team" | "enterprise";
      maxFileSizeMb?: number;
      force?: boolean;
      checkInterval?: number;
    },
  ) {
    this.url = config.url;
    this.ref = config.ref ?? "main";
    this.path = config.path ?? ".aligntrue.yaml";
    this.forceRefresh = config.forceRefresh ?? false;
    this.checkInterval =
      config.checkInterval ?? options?.checkInterval ?? 86400; // Default 24 hours
    this.offlineMode = options?.offlineMode ?? false;
    this.mode = options?.mode ?? "solo";
    this.maxFileSizeMb = options?.maxFileSizeMb ?? 10;
    this.force = options?.force ?? false;
    if (options?.consentManager !== undefined) {
      this.consentManager = options.consentManager;
    }

    // Validate URL format (security check)
    this.validateUrl(this.url);

    // Compute repo hash for cache directory naming
    this.repoHash = this.computeRepoHash(this.url);

    // Cache directory: .aligntrue/.cache/git/<repo-hash>/
    this.cacheDir = baseCacheDir;
    this.repoDir = join(this.cacheDir, this.repoHash);

    // Validate cache directory path (security check)
    this.validateCachePath(this.cacheDir);

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Fetch rules from git repository with smart caching
   *
   * Flow:
   * 1. Determine ref type (branch/tag/commit)
   * 2. Check if update check is needed based on TTL
   * 3. If check needed, compare local vs remote SHA
   * 4. If updates available, auto-pull (solo) or throw error (team)
   * 5. Return cached content
   */
  async fetch(ref?: string): Promise<string> {
    const targetRef = ref ?? this.ref;
    const refType = detectRefType(targetRef);

    // Load cache metadata
    let meta = loadCacheMeta(this.repoDir);

    // Initialize metadata if not exists (first fetch or migration)
    if (!meta && existsSync(this.repoDir)) {
      // Migrate existing cache: detect current SHA
      try {
        const currentSha = await this.getCommitSha();
        meta = {
          url: this.url,
          ref: targetRef,
          refType,
          resolvedSha: currentSha,
          lastFetched: new Date().toISOString(),
          lastChecked: new Date().toISOString(),
          updateStrategy: getUpdateStrategy(refType),
        };
        saveCacheMeta(this.repoDir, meta);
      } catch {
        // Corrupted cache, will re-clone
        meta = null;
      }
    }

    // Commit SHAs never change, use cache immediately
    if (refType === "commit" && existsSync(this.repoDir)) {
      return this.readRulesFile();
    }

    // Offline mode: use cache only, no network operations
    if (this.offlineMode) {
      if (existsSync(this.repoDir)) {
        return this.readRulesFile();
      }
      throw new Error(
        `Offline mode: no cache available for repository\n` +
          `  Repository: ${this.url}\n` +
          `  Run without --offline to fetch from network`,
      );
    }

    // ForceRefresh: bypass all checks and pull
    if (this.forceRefresh) {
      await this.pullUpdates(targetRef);
      return this.readRulesFile();
    }

    // Check if we should check for updates based on TTL
    if (meta && !shouldCheckForUpdates(meta, this.checkInterval)) {
      // TTL not expired, use cache
      return this.readRulesFile();
    }

    // Privacy consent check before network operation
    if (this.consentManager && !this.consentManager.checkConsent("git")) {
      if (existsSync(this.repoDir)) {
        // Have cache, use it with warning
        console.warn(
          `Network operation requires consent, using cached repository: ${this.url}`,
        );
        return this.readRulesFile();
      }
      throw new Error(
        `Network operation requires consent\n` +
          `  Repository: ${this.url}\n` +
          `  Grant consent with: aligntrue privacy grant git\n` +
          `  Or run with --offline to use cache only`,
      );
    }

    // Check for updates
    try {
      const updateInfo = await this.checkRemoteUpdates(targetRef);

      if (updateInfo.hasUpdates) {
        // Team mode: block and require approval
        if (this.mode === "team") {
          throw new UpdatesAvailableError({
            url: this.url,
            ref: targetRef,
            currentSha: updateInfo.currentSha,
            latestSha: updateInfo.latestSha,
            commitsBehind: updateInfo.commitsBehind,
          });
        }

        // Solo mode: auto-pull updates
        console.log(
          `Updates available for ${this.url} (${targetRef}), pulling latest...`,
        );
        await this.pullUpdates(targetRef);
      } else {
        // No updates, just update last checked timestamp
        this.updateCacheMeta({ lastChecked: new Date().toISOString() });
      }

      return this.readRulesFile();
    } catch (error) {
      // Network error - try cache fallback
      if (this.isNetworkError(error)) {
        if (existsSync(this.repoDir)) {
          console.warn(
            `Network unavailable, using cached repository: ${this.url}\n` +
              `  Cache may be stale. Will retry on next sync.`,
          );
          return this.readRulesFile();
        }

        // No cache available
        throw new Error(
          `Failed to check repository and no cache available\n` +
            `  URL: ${this.url}\n` +
            `  Ref: ${targetRef}\n` +
            `  Network error: ${error instanceof Error ? error.message : String(error)}\n` +
            `  Check your internet connection or try again later.`,
        );
      }

      // Rethrow non-network errors (including UpdatesAvailableError)
      throw error;
    }
  }

  /**
   * Check remote for updates using lightweight git ls-remote
   * Returns update information without pulling
   */
  private async checkRemoteUpdates(ref: string): Promise<{
    hasUpdates: boolean;
    currentSha: string;
    latestSha: string;
    commitsBehind: number;
  }> {
    // If no cache exists, we need to clone
    if (!existsSync(this.repoDir)) {
      await this.ensureRepository(ref);
      const sha = await this.getCommitSha();
      return {
        hasUpdates: false,
        currentSha: sha,
        latestSha: sha,
        commitsBehind: 0,
      };
    }

    // Get current local SHA
    const currentSha = await this.getCommitSha();

    // Get remote SHA using git ls-remote (lightweight, no fetch)
    const git = simpleGit();
    try {
      const result = await git.listRemote([this.url, ref]);
      const lines = result.trim().split("\n");
      const remoteSha = lines[0]?.split("\t")[0] ?? "";

      if (!remoteSha) {
        throw new Error(`Could not determine remote SHA for ${ref}`);
      }

      const hasUpdates = currentSha !== remoteSha;

      // Calculate commits behind (rough estimate, would need full fetch for exact count)
      const commitsBehind = hasUpdates ? 1 : 0; // Simplified, real impl would count commits

      return {
        hasUpdates,
        currentSha,
        latestSha: remoteSha,
        commitsBehind,
      };
    } catch (error) {
      throw new Error(
        `Failed to check remote updates\n` +
          `  URL: ${this.url}\n` +
          `  Ref: ${ref}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Pull updates from remote repository
   * Clones if cache doesn't exist, otherwise fetches and resets
   */
  private async pullUpdates(ref: string): Promise<void> {
    if (!existsSync(this.repoDir)) {
      // Clone for first time
      await this.ensureRepository(ref);
    } else {
      // Update existing repository
      const git = simpleGit(this.repoDir);
      try {
        // Fetch latest
        await git.fetch(["origin", ref, "--depth", "1"]);
        // Hard reset to remote ref
        await git.reset(["--hard", `origin/${ref}`]);
      } catch (error) {
        // Fetch/reset failed, try re-cloning
        console.warn(
          `Failed to update repository, re-cloning: ${error instanceof Error ? error.message : String(error)}`,
        );
        rmSync(this.repoDir, { recursive: true, force: true });
        await this.ensureRepository(ref);
      }
    }

    // Update metadata
    const sha = await this.getCommitSha();
    const refType = detectRefType(ref);
    const now = new Date().toISOString();

    saveCacheMeta(this.repoDir, {
      url: this.url,
      ref,
      refType,
      resolvedSha: sha,
      lastFetched: now,
      lastChecked: now,
      updateStrategy: getUpdateStrategy(refType),
    });
  }

  /**
   * Update cache metadata with partial updates
   */
  private updateCacheMeta(partial: Partial<CacheMeta>): void {
    const meta = loadCacheMeta(this.repoDir);
    if (meta) {
      saveCacheMeta(this.repoDir, { ...meta, ...partial });
    }
  }

  /**
   * Ensure repository is cloned and checked out to correct ref
   */
  private async ensureRepository(ref: string): Promise<void> {
    const git: SimpleGit = simpleGit();

    if (!existsSync(this.repoDir)) {
      // Clone repository (shallow)
      try {
        await git.clone(this.url, this.repoDir, [
          "--depth",
          "1",
          "--branch",
          ref,
          "--single-branch",
        ]);

        // Initialize metadata
        const sha = await this.getCommitSha();
        const refType = detectRefType(ref);
        const now = new Date().toISOString();

        saveCacheMeta(this.repoDir, {
          url: this.url,
          ref,
          refType,
          resolvedSha: sha,
          lastFetched: now,
          lastChecked: now,
          updateStrategy: getUpdateStrategy(refType),
        });
      } catch (error) {
        // Clean up partial clone on error
        if (existsSync(this.repoDir)) {
          rmSync(this.repoDir, { recursive: true, force: true });
        }

        // Add helpful context to error
        if (error instanceof GitError) {
          throw new Error(
            `Git clone failed: ${error.message}\n` +
              `  URL: ${this.url}\n` +
              `  Ref: ${ref}\n` +
              this.getGitErrorHint(error),
          );
        }

        throw error;
      }
    } else {
      // Repository exists, checkout ref (in case it changed)
      const repoGit = simpleGit(this.repoDir);

      try {
        // Fetch latest (shallow) if we need a different ref
        const currentBranch = await repoGit.revparse(["--abbrev-ref", "HEAD"]);
        if (currentBranch.trim() !== ref) {
          await repoGit.fetch(["origin", ref, "--depth", "1"]);
          await repoGit.checkout(ref);
        }
      } catch (error) {
        // Checkout failed, might be corrupted cache - remove and retry
        if (error instanceof GitError) {
          console.warn(
            `Git checkout failed, removing cache and retrying: ${error.message}`,
          );
          rmSync(this.repoDir, { recursive: true, force: true });

          // Retry clone
          await this.ensureRepository(ref);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get the current commit SHA from the cloned repository
   * Must be called after fetch() to ensure repository exists
   */
  async getCommitSha(): Promise<string> {
    if (!existsSync(this.repoDir)) {
      throw new Error(
        `Repository not cloned yet. Call fetch() first.\n` +
          `  URL: ${this.url}`,
      );
    }

    const git = simpleGit(this.repoDir);
    try {
      const sha = await git.revparse(["HEAD"]);
      return sha.trim();
    } catch (error) {
      throw new Error(
        `Failed to get commit SHA from repository\n` +
          `  URL: ${this.url}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Read rules file from cloned repository
   *
   * Performance guardrails:
   * - Checks file size against limits before reading
   * - Respects .gitignore (documentation only - we read one specific file)
   */
  private readRulesFile(): string {
    const filePath = join(this.repoDir, this.path);

    if (!existsSync(filePath)) {
      throw new Error(
        `Rules file not found in repository\n` +
          `  URL: ${this.url}\n` +
          `  Path: ${this.path}\n` +
          `  Expected: ${filePath}\n` +
          `  Tip: Check that the repository contains this file at the specified path.`,
      );
    }

    // Check .gitignore (documentation/future-proofing - currently we only read one specific file)
    const gitignorePath = join(this.repoDir, ".gitignore");
    if (existsSync(gitignorePath)) {
      const ignoreFilter = createIgnoreFilter(gitignorePath);
      if (ignoreFilter(this.path)) {
        console.warn(
          `⚠️  Warning: Rules file is in .gitignore\n` +
            `  URL: ${this.url}\n` +
            `  Path: ${this.path}\n` +
            `  This may indicate a configuration issue.`,
        );
      }
    }

    // Check file size before reading (performance guardrail)
    checkFileSize(filePath, this.maxFileSizeMb, this.mode, this.force);

    try {
      const content = readFileSync(filePath, "utf-8");

      // Basic validation that it's not empty
      if (
        content === undefined ||
        content === null ||
        content.trim().length === 0
      ) {
        throw new Error(
          `Rules file is empty\n` +
            `  URL: ${this.url}\n` +
            `  Path: ${this.path}`,
        );
      }

      return content;
    } catch (error) {
      // If error already thrown, re-throw it
      if (
        error instanceof Error &&
        error.message.includes("Rules file is empty")
      ) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `Rules file not found in repository\n` +
            `  URL: ${this.url}\n` +
            `  Path: ${this.path}`,
        );
      }

      throw new Error(
        `Failed to read rules file\n` +
          `  URL: ${this.url}\n` +
          `  Path: ${this.path}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate URL format and reject dangerous patterns
   */
  private validateUrl(url: string): void {
    // Reject file:// protocol (security check)
    if (url.startsWith("file://")) {
      throw new Error(
        `Invalid git URL: ${url}\n` +
          `  file:// protocol is not allowed for security reasons`,
      );
    }

    // Check for path traversal attempts
    if (url.includes("..")) {
      throw new Error(
        `Invalid git URL: ${url}\n` +
          `  URLs cannot contain '..' (path traversal detected)`,
      );
    }

    // Validate URL format (https or git@)
    const validUrlPattern = /^(https?:\/\/|git@)/;
    if (!validUrlPattern.test(url)) {
      throw new Error(
        `Invalid git URL format: ${url}\n` +
          `  Expected: https://github.com/org/repo or git@github.com:org/repo.git\n` +
          `  Supported protocols: https, http, ssh (git@)`,
      );
    }

    // Additional validation for ssh URLs
    if (url.startsWith("git@")) {
      // Should match: git@hostname:org/repo.git
      const sshPattern = /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9._/-]+\.git$/;
      if (!sshPattern.test(url)) {
        throw new Error(
          `Invalid ssh git URL format: ${url}\n` +
            `  Expected: git@hostname:org/repo.git`,
        );
      }
    }
  }

  /**
   * Validate cache directory path (security check)
   */
  private validateCachePath(cachePath: string): void {
    // Check for path traversal attempts
    if (cachePath.includes("..")) {
      throw new Error(
        `Invalid cache path: ${cachePath}\n` +
          `  Cache paths cannot contain '..' (parent directory traversal)`,
      );
    }

    // Check for absolute paths outside workspace
    if (cachePath.startsWith("/") || /^[A-Za-z]:/.test(cachePath)) {
      // Allow absolute paths but warn (for testing)
      // In production, cache should be relative to workspace root
    }
  }

  /**
   * Compute SHA-256 hash of URL for cache directory naming
   */
  private computeRepoHash(url: string): string {
    return createHash("sha256").update(url).digest("hex").substring(0, 16); // First 16 chars for shorter directory names
  }

  /**
   * Check if error is a network error (for cache fallback logic)
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    // Common network error indicators (specific patterns only)
    return (
      message.includes("network unavailable") ||
      message.includes("enotfound") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("could not resolve") ||
      message.includes("unable to access")
    );
  }

  /**
   * Get helpful hint for common git errors
   */
  private getGitErrorHint(error: GitError): string {
    const message = error.message.toLowerCase();

    if (message.includes("authentication") || message.includes("permission")) {
      return (
        `  Hint: Authentication failed. For private repositories:\n` +
        `    - Use SSH URLs (git@github.com:org/repo.git) with SSH keys\n` +
        `    - Or use HTTPS URLs with credentials (not recommended)\n` +
        `    - Check that your SSH keys are configured: ssh -T git@github.com`
      );
    }

    if (message.includes("not found") || message.includes("404")) {
      return (
        `  Hint: Repository not found. Check that:\n` +
        `    - The URL is correct\n` +
        `    - The repository exists\n` +
        `    - You have access to the repository`
      );
    }

    if (message.includes("branch") || message.includes("ref")) {
      return (
        `  Hint: Branch/ref not found. Check that:\n` +
        `    - The branch/tag/commit exists\n` +
        `    - The ref name is spelled correctly\n` +
        `    - Use 'main' or 'master' for default branches`
      );
    }

    return "";
  }
}
