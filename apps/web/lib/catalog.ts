/**
 * Catalog utilities for sitemap generation
 *
 * Reads catalog entries from /public/catalog/index.json for sitemap generation.
 */

import { readFile } from "fs/promises";
import { join } from "path";

export interface CatalogEntry {
  slug: string;
  lastModified?: string;
}

interface CatalogIndex {
  packs: Array<{
    slug: string;
    last_updated?: string;
  }>;
}

/**
 * List all catalog entries from index.json
 *
 * @returns Array of catalog entries with slug and lastModified
 */
export async function listCatalogEntries(): Promise<CatalogEntry[]> {
  try {
    const catalogPath = join(process.cwd(), "public", "catalog", "index.json");
    const data = await readFile(catalogPath, "utf-8");
    const catalog: CatalogIndex = JSON.parse(data);

    return catalog.packs.map((pack) => ({
      slug: pack.slug,
      lastModified: pack.last_updated
        ? new Date(pack.last_updated).toISOString()
        : undefined,
    }));
  } catch (error) {
    console.error("Failed to load catalog entries:", error);
    return [];
  }
}
