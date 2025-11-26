/**
 * Source providers for pulling rules from multiple locations
 */

export type SourceType = "local" | "git" | "url";

/**
 * Git-specific configuration
 */
export interface GitSourceConfig extends SourceConfig {
  type: "git";
  url: string; // https:// or git@github.com: format
  ref?: string; // branch/tag/commit (default: 'main')
  path?: string; // path to .aligntrue.yaml in repo (default: '.aligntrue.yaml')
  forceRefresh?: boolean; // bypass cache
}

/**
 * URL-specific configuration (re-exported from url.ts)
 */
export { UrlSourceConfig } from "./url.js";

export interface SourceProvider {
  type: SourceType;
  fetch(ref: string): Promise<string>;
}

export interface SourceConfig {
  type: SourceType;
  path?: string;
  url?: string;
}

// Re-export provider implementations for direct use
export { GitProvider } from "./git.js";
export type {
  GitProviderOptions,
  GitProgressUpdate,
  GitProgressPhase,
} from "./git.js";
export { LocalProvider } from "./local.js";
export { UrlProvider } from "./url.js";
export type { UrlProviderOptions } from "./url.js";

// Re-export error types
export { UpdatesAvailableError } from "./errors.js";
export type { UpdateInfo } from "./errors.js";

// Re-export cache metadata utilities
export {
  detectRefType,
  loadCacheMeta,
  saveCacheMeta,
  shouldCheckForUpdates,
  getUpdateStrategy,
} from "./cache-meta.js";
export type { CacheMeta, RefType, UpdateStrategy } from "./cache-meta.js";
