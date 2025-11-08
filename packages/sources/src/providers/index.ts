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
export type { GitProviderOptions } from "./git.js";
export { LocalProvider } from "./local.js";
