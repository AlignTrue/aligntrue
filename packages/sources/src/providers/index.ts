/**
 * Source providers for pulling rules from multiple locations
 */

import { getCacheDir } from "@aligntrue/core";

export type SourceType = "local" | "catalog" | "git" | "url";

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
  id?: string; // For catalog sources
}

/**
 * Catalog-specific configuration
 */
export interface CatalogSourceConfig extends SourceConfig {
  type: "catalog";
  id: string; // Pack ID (e.g., "packs/base/base-global")
  forceRefresh?: boolean;
  warnOnStaleCache?: boolean;
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

    case "catalog": {
      if (!config.id) {
        throw new Error(
          'Catalog source requires "id" field (e.g., "packs/base/base-global")',
        );
      }
      const { CatalogProvider } = require("./catalog.js");
      return new CatalogProvider({
        cacheDir: getCacheDir("catalog", cwd),
        forceRefresh: (config as CatalogSourceConfig).forceRefresh,
        warnOnStaleCache: (config as CatalogSourceConfig).warnOnStaleCache,
      });
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
export { CatalogProvider } from "./catalog.js";
export type {
  CatalogIndex,
  CatalogEntry,
  CatalogProviderOptions,
} from "./catalog.js";
export { GitProvider } from "./git.js";
export type { GitProviderOptions } from "./git.js";
export { LocalProvider } from "./local.js";
