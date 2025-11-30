/**
 * URL source provider - DEPRECATED
 *
 * This provider is no longer supported. Plain HTTP/HTTPS URLs are not suitable
 * for rule sources because they lack directory listing capabilities.
 *
 * Use git repositories instead (GitHub, GitLab, Bitbucket, or self-hosted).
 * They provide full directory scanning, versioning, and are more reliable.
 *
 * DEPRECATED: This file is kept for backward compatibility only.
 * It will be removed in a future major version.
 *
 * Migration: Update your config to use git URLs instead.
 * Example:
 *   Old: https://example.com/rules.yaml
 *   New: https://github.com/org/rules
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { SourceProvider } from "./index.js";
import type { ConsentManager } from "@aligntrue/core";
import { computeHash } from "@aligntrue/schema";

/**
 * URL source configuration
 */
export interface UrlSourceConfig {
  type: "url";
  url: string; // https:// URL to fetch
  forceRefresh?: boolean; // bypass cache
  checkInterval?: number; // override default check interval (seconds)
}

/**
 * URL provider options
 */
export interface UrlProviderOptions {
  cacheDir: string;
  url: string;
  forceRefresh: boolean;
  checkInterval: number;
  offlineMode?: boolean;
  consentManager?: ConsentManager;
}

/**
 * Cache metadata for URL sources
 */
interface UrlCacheMeta {
  url: string;
  etag: string | undefined;
  lastModified: string | undefined;
  lastFetched: string;
  lastChecked: string;
  contentHash: string;
}

/**
 * URL provider implementation
 */
export class UrlProvider implements SourceProvider {
  type = "url" as const;
  private cacheDir: string;
  private url: string;
  private forceRefresh: boolean;
  private checkInterval: number;
  private urlHash: string;
  private cacheFile: string;
  private metaFile: string;
  private offlineMode: boolean;
  private consentManager?: ConsentManager;

  constructor(
    config: UrlSourceConfig,
    baseCacheDir: string = ".aligntrue/.cache/url",
    options?: {
      offlineMode?: boolean;
      consentManager?: ConsentManager;
      checkInterval?: number;
    },
  ) {
    this.url = config.url;
    this.forceRefresh = config.forceRefresh ?? false;
    this.checkInterval = config.checkInterval ?? options?.checkInterval ?? 3600; // Default 1 hour
    this.offlineMode = options?.offlineMode ?? false;
    if (options?.consentManager !== undefined) {
      this.consentManager = options.consentManager;
    }

    // Validate URL format (security check)
    this.validateUrl(this.url);

    // Compute URL hash for cache file naming
    this.urlHash = this.computeUrlHash(this.url);

    // Cache directory and files
    this.cacheDir = baseCacheDir;
    this.cacheFile = join(this.cacheDir, `${this.urlHash}.content`);
    this.metaFile = join(this.cacheDir, `${this.urlHash}.meta.json`);

    // Ensure cache directory exists
    try {
      mkdirSync(this.cacheDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  /**
   * Fetch content from URL with caching
   *
   * Flow:
   * 1. Check if cache exists and is fresh
   * 2. If check needed, use conditional request (ETag/Last-Modified)
   * 3. If content changed, update cache
   * 4. Return cached or fetched content
   */
  async fetch(_ref?: string): Promise<string> {
    // Load cache metadata
    const meta = this.loadCacheMeta();

    // Offline mode: use cache only, no network operations
    if (this.offlineMode) {
      if (existsSync(this.cacheFile)) {
        return this.readCachedContent();
      }
      throw new Error(
        `Offline mode: no cache available for URL\n` +
          `  URL: ${this.url}\n` +
          `  Run without --offline to fetch from network`,
      );
    }

    // ForceRefresh: bypass all checks and fetch
    if (this.forceRefresh) {
      return await this.fetchAndCache();
    }

    // Check if we should check for updates based on TTL
    if (meta && !this.shouldCheckForUpdates(meta)) {
      // TTL not expired, use cache
      return this.readCachedContent();
    }

    // Privacy consent check before network operation
    if (this.consentManager && !this.consentManager.checkConsent("url")) {
      if (existsSync(this.cacheFile)) {
        // Have cache, use it with warning
        console.warn(
          `Network operation requires consent, using cached content: ${this.url}`,
        );
        return this.readCachedContent();
      }
      throw new Error(
        `Network operation requires consent\n` +
          `  URL: ${this.url}\n` +
          `  Grant consent with: aligntrue privacy grant url\n` +
          `  Or run with --offline to use cache only`,
      );
    }

    // Fetch with conditional request
    try {
      return await this.fetchWithConditional(meta);
    } catch (error) {
      // Network error - try cache fallback
      if (this.isNetworkError(error)) {
        if (existsSync(this.cacheFile)) {
          console.warn(
            `Network unavailable, using cached content: ${this.url}\n` +
              `  Cache may be stale. Will retry on next sync.`,
          );
          return this.readCachedContent();
        }

        // No cache available
        throw new Error(
          `Failed to fetch URL and no cache available\n` +
            `  URL: ${this.url}\n` +
            `  Network error: ${error instanceof Error ? error.message : String(error)}\n` +
            `  Check your internet connection or try again later.`,
        );
      }

      throw error;
    }
  }

  /**
   * Fetch content using conditional request (ETag/Last-Modified)
   */
  private async fetchWithConditional(
    meta: UrlCacheMeta | null,
  ): Promise<string> {
    const headers: Record<string, string> = {
      "User-Agent": "AlignTrue/1.0",
    };

    // Add conditional headers if we have cached metadata
    if (meta?.etag) {
      headers["If-None-Match"] = meta.etag;
    }
    if (meta?.lastModified) {
      headers["If-Modified-Since"] = meta.lastModified;
    }

    // Safe: headers are validated HTTP response headers (etag, last-modified).
    // this.url is validated via validateUrl() at constructor. No user input flows through headers.
    const response = await fetch(this.url, { headers });

    // 304 Not Modified - content unchanged
    if (response.status === 304 && existsSync(this.cacheFile)) {
      // Update last checked timestamp
      this.updateCacheMeta({ lastChecked: new Date().toISOString() });
      return this.readCachedContent();
    }

    // Check for errors
    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL\n` +
          `  URL: ${this.url}\n` +
          `  Status: ${response.status} ${response.statusText}`,
      );
    }

    // Get content and cache it
    const content = await response.text();
    const contentHash = computeHash(content);

    // Safe: this.cacheFile is controlled internal path (.aligntrue/.cache/url/<hash>.content).
    // Cache directory is created at constructor, never from user input.
    writeFileSync(this.cacheFile, content, "utf-8");

    // Save metadata
    const now = new Date().toISOString();
    const newMeta: UrlCacheMeta = {
      url: this.url,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
      lastFetched: now,
      lastChecked: now,
      contentHash,
    };
    this.saveCacheMeta(newMeta);

    return content;
  }

  /**
   * Fetch and cache without conditional headers (force refresh)
   */
  private async fetchAndCache(): Promise<string> {
    const response = await fetch(this.url, {
      headers: { "User-Agent": "AlignTrue/1.0" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL\n` +
          `  URL: ${this.url}\n` +
          `  Status: ${response.status} ${response.statusText}`,
      );
    }

    const content = await response.text();
    const contentHash = computeHash(content);

    // Safe: this.cacheFile is controlled internal path (.aligntrue/.cache/url/<hash>.content).
    // Cache directory is created at constructor, never from user input.
    writeFileSync(this.cacheFile, content, "utf-8");

    // Save metadata
    const now = new Date().toISOString();
    const newMeta: UrlCacheMeta = {
      url: this.url,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
      lastFetched: now,
      lastChecked: now,
      contentHash,
    };
    this.saveCacheMeta(newMeta);

    return content;
  }

  /**
   * Read cached content from disk
   */
  private readCachedContent(): string {
    if (!existsSync(this.cacheFile)) {
      throw new Error(
        `Cache file not found\n` +
          `  URL: ${this.url}\n` +
          `  Expected: ${this.cacheFile}`,
      );
    }

    const content = readFileSync(this.cacheFile, "utf-8");

    if (content.trim().length === 0) {
      throw new Error(`Cached content is empty\n` + `  URL: ${this.url}`);
    }

    return content;
  }

  /**
   * Load cache metadata from disk
   */
  private loadCacheMeta(): UrlCacheMeta | null {
    if (!existsSync(this.metaFile)) {
      return null;
    }

    try {
      const content = readFileSync(this.metaFile, "utf-8");
      return JSON.parse(content) as UrlCacheMeta;
    } catch {
      return null;
    }
  }

  /**
   * Save cache metadata to disk
   */
  private saveCacheMeta(meta: UrlCacheMeta): void {
    writeFileSync(this.metaFile, JSON.stringify(meta, null, 2), "utf-8");
  }

  /**
   * Update cache metadata with partial updates
   */
  private updateCacheMeta(partial: Partial<UrlCacheMeta>): void {
    const meta = this.loadCacheMeta();
    if (meta) {
      this.saveCacheMeta({ ...meta, ...partial });
    }
  }

  /**
   * Check if we should check for updates based on TTL
   */
  private shouldCheckForUpdates(meta: UrlCacheMeta): boolean {
    const lastChecked = new Date(meta.lastChecked).getTime();
    const now = Date.now();
    const elapsed = (now - lastChecked) / 1000; // seconds

    return elapsed >= this.checkInterval;
  }

  /**
   * Validate URL format and reject dangerous patterns
   */
  private validateUrl(url: string): void {
    // Validate URL format using URL constructor (secure parsing)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(
        `Invalid URL format: ${url}\n` + `  Expected a valid HTTP/HTTPS URL`,
      );
    }

    // Only allow https and http protocols (secure protocol validation)
    const protocol = parsedUrl.protocol;
    if (protocol !== "https:" && protocol !== "http:") {
      throw new Error(
        `Invalid URL protocol: ${url}\n` +
          `  Only https:// and http:// URLs are supported`,
      );
    }

    // Check for path traversal attempts
    if (url.includes("..")) {
      throw new Error(
        `Invalid URL: ${url}\n` +
          `  URLs cannot contain '..' (path traversal detected)`,
      );
    }
  }

  /**
   * Compute SHA-256 hash of URL for cache file naming
   */
  private computeUrlHash(url: string): string {
    return computeHash(url).substring(0, 16); // First 16 chars for shorter file names
  }

  /**
   * Check if error is a network error (for cache fallback logic)
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    // Common network error indicators
    return (
      message.includes("network") ||
      message.includes("enotfound") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("fetch failed") ||
      message.includes("unable to connect")
    );
  }
}
