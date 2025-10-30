/**
 * Git source provider - clones rules from any git repository
 *
 * Strategy:
 * - Clones repository to .aligntrue/.cache/git/<repo-hash>/
 * - Uses shallow clone (--depth 1) for speed and space
 * - Caches indefinitely (manual forceRefresh only)
 * - Falls back to cache when network unavailable
 * - Supports https and ssh URLs, branch/tag/commit refs
 *
 * Privacy:
 * - Requires user consent before first git clone
 * - Respects offline mode (uses cache only, no network)
 * - Clear error messages when consent denied
 */

import { readFileSync, existsSync, mkdirSync, rmSync, statSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import simpleGit, { SimpleGit, GitError } from "simple-git";
import type { SourceProvider } from "./index.js";
import type { ConsentManager } from "@aligntrue/core";
import { checkFileSize, createIgnoreFilter } from "@aligntrue/core/performance";

/**
 * Git source configuration
 */
export interface GitSourceConfig {
  type: "git";
  url: string; // https:// or git@github.com: format
  ref?: string; // branch/tag/commit (default: 'main')
  path?: string; // path to rules file in repo (default: '.aligntrue.yaml')
  forceRefresh?: boolean; // bypass cache
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
    },
  ) {
    this.url = config.url;
    this.ref = config.ref ?? "main";
    this.path = config.path ?? ".aligntrue.yaml";
    this.forceRefresh = config.forceRefresh ?? false;
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

    // Validate cache directory path (security check from Step 20)
    this.validateCachePath(this.cacheDir);

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Fetch rules from git repository
   *
   * Flow:
   * 1. Check cache (unless forceRefresh)
   * 2. Clone or pull repository
   * 3. Checkout specified ref
   * 4. Read rules file
   * 5. Return content
   */
  async fetch(ref?: string): Promise<string> {
    // Use provided ref or fall back to constructor ref
    const targetRef = ref ?? this.ref;

    // Check cache first (unless forceRefresh)
    if (!this.forceRefresh && existsSync(this.repoDir)) {
      try {
        const content = this.readRulesFile();
        console.warn(
          `Using cached repository: ${this.url} (ref: ${targetRef})\n` +
            `  Use forceRefresh: true to update`,
        );
        return content;
      } catch (error) {
        // Cache corrupted or file missing, will re-clone
        console.warn(
          `Cache corrupted or file missing, will re-clone: ${this.url}\n` +
            `  ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Offline mode: use cache only, no network operations
    if (this.offlineMode) {
      if (existsSync(this.repoDir)) {
        try {
          const content = this.readRulesFile();
          return content;
        } catch (error) {
          throw new Error(
            `Offline mode: cache exists but cannot read rules file\n` +
              `  Repository: ${this.url}\n` +
              `  Error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      throw new Error(
        `Offline mode: no cache available for repository\n` +
          `  Repository: ${this.url}\n` +
          `  Run without --offline to fetch from network`,
      );
    }

    // Privacy consent check before network operation
    if (this.consentManager && !this.consentManager.checkConsent("git")) {
      throw new Error(
        `Network operation requires consent\n` +
          `  Repository: ${this.url}\n` +
          `  Grant consent with: aligntrue privacy grant git\n` +
          `  Or run with --offline to use cache only`,
      );
    }

    try {
      // Clone or update repository
      await this.ensureRepository(targetRef);

      // Read rules file
      const content = this.readRulesFile();
      return content;
    } catch (error) {
      // Network error - try cache fallback
      if (this.isNetworkError(error)) {
        if (existsSync(this.repoDir)) {
          try {
            const content = this.readRulesFile();
            console.warn(
              `Network unavailable, using cached repository: ${this.url}\n` +
                `  Cache may be stale. Will retry on next sync.`,
            );
            return content;
          } catch (readError) {
            // Cache exists but file missing/corrupted
            throw new Error(
              `Failed to fetch from ${this.url} and cache is corrupted\n` +
                `  Network error: ${error instanceof Error ? error.message : String(error)}\n` +
                `  Cache error: ${readError instanceof Error ? readError.message : String(readError)}`,
            );
          }
        }

        // No cache available
        throw new Error(
          `Failed to clone repository and no cache available\n` +
            `  URL: ${this.url}\n` +
            `  Ref: ${targetRef}\n` +
            `  Network error: ${error instanceof Error ? error.message : String(error)}\n` +
            `  Check your internet connection or try again later.`,
        );
      }

      // Not a network error, rethrow with context
      throw new Error(
        `Failed to fetch from git repository\n` +
          `  URL: ${this.url}\n` +
          `  Ref: ${targetRef}\n` +
          `  ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Ensure repository is cloned and checked out to correct ref
   */
  private async ensureRepository(ref: string): Promise<void> {
    const git: SimpleGit = simpleGit();

    // If forceRefresh, clone to temp location first, then replace on success
    if (this.forceRefresh && existsSync(this.repoDir)) {
      const tempDir = `${this.repoDir}.tmp`;

      try {
        // Clone to temp directory
        await git.clone(this.url, tempDir, [
          "--depth",
          "1",
          "--branch",
          ref,
          "--single-branch",
        ]);

        // Success! Now replace old cache
        rmSync(this.repoDir, { recursive: true, force: true });
        const { renameSync } = require("fs");
        renameSync(tempDir, this.repoDir);
      } catch (error) {
        // Clean up temp on error, keep old cache for fallback
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
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
      return;
    }

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
   * Validate cache directory path (security check from Step 20)
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
