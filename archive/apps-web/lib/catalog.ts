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

/**
 * Load full catalog index server-side
 * Used for SSR and static generation
 *
 * @returns Catalog index with all packs, or null if load fails
 */
export async function loadCatalogIndex() {
  try {
    const catalogPath = join(process.cwd(), "public", "catalog", "index.json");
    const data = await readFile(catalogPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load catalog index:", error);
    return null;
  }
}

export interface PopularPack {
  slug: string;
  name: string;
}

/**
 * Get popular packs for 404 page suggestions
 * Returns top 3 packs prioritizing foundations category and base-global first
 *
 * @returns Array of popular pack slugs and names
 */
export async function getPopularPacks(): Promise<PopularPack[]> {
  try {
    const catalog = await loadCatalogIndex();
    if (!catalog?.packs) {
      return [];
    }

    // Prioritize base-global, then other foundation packs, then others
    const packs = catalog.packs
      .filter((pack: { slug: string }) => pack.slug) // Ensure slug exists
      .sort(
        (
          a: { slug: string; categories?: string[] },
          b: { slug: string; categories?: string[] },
        ) => {
          // base-global always first
          if (a.slug === "base-global") return -1;
          if (b.slug === "base-global") return 1;

          // Then foundation packs
          const aIsFoundation = a.categories?.includes("foundations") ?? false;
          const bIsFoundation = b.categories?.includes("foundations") ?? false;
          if (aIsFoundation && !bIsFoundation) return -1;
          if (!aIsFoundation && bIsFoundation) return 1;

          return 0;
        },
      )
      .slice(0, 3)
      .map((pack: { slug: string; name: string }) => ({
        slug: pack.slug,
        name: pack.name,
      }));

    return packs;
  } catch (error) {
    console.error("Failed to load popular packs:", error);
    // Fallback to hardcoded values if catalog fails to load
    return [
      { slug: "base-global", name: "Base Global" },
      { slug: "base-typescript", name: "TypeScript Standards" },
      { slug: "base-security", name: "Security and Compliance" },
    ];
  }
}
