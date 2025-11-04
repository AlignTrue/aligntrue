/**
 * Source providers for pulling rules from multiple locations
 */

import { getCacheDir } from "@aligntrue/core";

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

/**
 * Create a source provider based on configuration
 */
export function createProvider(
  config: SourceConfig,
  cwd: string = process.cwd(),
): SourceProvider {
  switch (config.type) {
    case "local": {
      if (!config.path) {
        throw new Error('Local source requires "path" field');
      }
      const { LocalProvider } = require("./local.js");
      return new LocalProvider(config.path);
    }

    case "git": {
      if (!config.url) {
        throw new Error(
          'Git source requires "url" field (e.g., "https://github.com/org/rules-repo")',
        );
      }
      const { GitProvider } = require("./git.js");
      return new GitProvider(
        config as GitSourceConfig,
        getCacheDir("git", cwd),
      );
    }

    case "url":
      throw new Error(
        `Source type "${config.type}" not yet implemented (Phase 2+)`,
      );

    default:
      throw new Error(`Unknown source type: ${(config as SourceConfig).type}`);
  }
}

// Re-export provider implementations for direct use
export { GitProvider } from "./git.js";
export type { GitProviderOptions } from "./git.js";
export { LocalProvider } from "./local.js";
