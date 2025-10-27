/**
 * Source providers for pulling rules from multiple locations
 */

export type SourceType = 'local' | 'catalog' | 'git' | 'url';

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
  type: 'catalog';
  id: string; // Pack ID (e.g., "packs/base/base-global")
  forceRefresh?: boolean;
  warnOnStaleCache?: boolean;
}

/**
 * Constants for catalog provider
 */
export const CATALOG_CACHE_DIR = '.aligntrue/.cache/catalog';

/**
 * Create a source provider based on configuration
 */
export function createProvider(config: SourceConfig): SourceProvider {
  switch (config.type) {
    case 'local': {
      if (!config.path) {
        throw new Error('Local source requires "path" field');
      }
      const { LocalProvider } = require('./local.js');
      return new LocalProvider(config.path);
    }

    case 'catalog': {
      if (!config.id) {
        throw new Error('Catalog source requires "id" field (e.g., "packs/base/base-global")');
      }
      const { CatalogProvider } = require('./catalog.js');
      return new CatalogProvider({
        cacheDir: CATALOG_CACHE_DIR,
        forceRefresh: (config as CatalogSourceConfig).forceRefresh,
        warnOnStaleCache: (config as CatalogSourceConfig).warnOnStaleCache,
      });
    }

    case 'git':
    case 'url':
      throw new Error(`Source type "${config.type}" not yet implemented (Phase 2+)`);

    default:
      throw new Error(`Unknown source type: ${(config as SourceConfig).type}`);
  }
}

