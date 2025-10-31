/**
 * Search utilities for catalog discovery (Phase 4, Session 2)
 *
 * Fuse.js configuration and search result ranking for catalog packs.
 * Loads search_v1.json index and provides fuzzy search over title,
 * description, tags, and categories.
 */

import Fuse from "fuse.js";
import type { CatalogEntryExtended } from "@aligntrue/schema";

/**
 * Search index entry (subset of CatalogEntryExtended for client-side search)
 */
export interface SearchIndexEntry {
  id: string;
  name: string;
  slug: string;
  description: string;
  summary_bullets: string[];
  categories: string[];
  tags: string[];
  compatible_tools: string[];
  license: string;
  last_updated: string;
  has_plugs: boolean;
  overlay_friendly: boolean;
  stats: {
    copies_7d: number;
  };
}

/**
 * Search index structure (matches search_v1.json)
 */
export interface SearchIndex {
  version: string;
  generated_at: string;
  entries: SearchIndexEntry[];
}

/**
 * Fuse.js search options optimized for catalog discovery
 */
const FUSE_OPTIONS: any = {
  // Temporary: Using any for Fuse options due to type export issues
  // Keys to search with weights (higher = more important)
  keys: [
    { name: "name", weight: 3.0 },
    { name: "description", weight: 2.0 },
    { name: "summary_bullets", weight: 1.5 },
    { name: "tags", weight: 1.0 },
    { name: "categories", weight: 1.0 },
  ],

  // Fuzzy matching threshold (0.0 = perfect match, 1.0 = match anything)
  threshold: 0.4,

  // Include match info for highlighting
  includeScore: true,
  includeMatches: true,

  // Search algorithm settings
  ignoreLocation: true, // Search entire string, not just prefix
  minMatchCharLength: 2, // Minimum 2 characters to trigger search
  findAllMatches: true,

  // Use extended search syntax (enables prefix/suffix/exact match)
  useExtendedSearch: false,
};

/**
 * Search filter options
 */
export interface SearchFilters {
  /** Selected tool filters (e.g., ["cursor", "claude-code"]) */
  tools?: string[];
  /** Selected category filters (e.g., ["code-quality", "security"]) */
  categories?: string[];
  /** License filter (SPDX identifier) */
  license?: string;
  /** Minimum last updated date (ISO 8601) */
  lastUpdatedAfter?: string;
  /** Has plugs filter */
  hasPlugs?: boolean;
  /** Overlay-friendly filter */
  overlayFriendly?: boolean;
}

/**
 * Sort order options
 */
export type SortOrder =
  | "most-copied-7d"
  | "trending"
  | "recently-updated"
  | "name-asc";

/**
 * Search result with score and highlights
 */
export interface SearchResult {
  item: SearchIndexEntry;
  score: number;
  matches?: any[]; // Temporary: Using any for Fuse match results due to type export issues
}

/**
 * Load search index from JSON
 *
 * @param indexUrl - URL to search_v1.json
 * @returns Search index
 */
export async function loadSearchIndex(indexUrl: string): Promise<SearchIndex> {
  const response = await fetch(indexUrl);
  if (!response.ok) {
    throw new Error(`Failed to load search index: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create Fuse.js search instance
 *
 * @param entries - Search index entries
 * @returns Fuse instance
 */
export function createSearchInstance(
  entries: SearchIndexEntry[],
): Fuse<SearchIndexEntry> {
  return new Fuse(entries, FUSE_OPTIONS);
}

/**
 * Search catalog with filters
 *
 * @param fuse - Fuse search instance
 * @param query - Search query (empty string returns all)
 * @param filters - Optional filters
 * @returns Search results
 */
export function searchCatalog(
  fuse: Fuse<SearchIndexEntry>,
  query: string,
  filters?: SearchFilters,
): SearchResult[] {
  // Get base results
  let results: SearchResult[];

  if (query.trim() === "") {
    // No query: return all entries with score 0
    const allEntries: SearchIndexEntry[] = (fuse as any).getIndex().docs;
    results = allEntries.map((item) => ({ item, score: 0 }));
  } else {
    // Run fuzzy search
    const fuseResults = fuse.search(query);
    results = fuseResults.map((r) => ({
      item: r.item,
      score: r.score ?? 0,
      matches: r.matches ? [...r.matches] : undefined,
    }));
  }

  // Apply filters
  if (filters) {
    results = results.filter((result) => {
      const { item } = result;

      // Tool filter (AND logic: pack must support ALL selected tools)
      if (filters.tools && filters.tools.length > 0) {
        const hasAllTools = filters.tools.every((tool) =>
          item.compatible_tools.includes(tool),
        );
        if (!hasAllTools) return false;
      }

      // Category filter (OR logic: pack must have at least one selected category)
      if (filters.categories && filters.categories.length > 0) {
        const hasAnyCategory = filters.categories.some((cat) =>
          item.categories.includes(cat),
        );
        if (!hasAnyCategory) return false;
      }

      // License filter
      if (filters.license && item.license !== filters.license) {
        return false;
      }

      // Last updated filter
      if (filters.lastUpdatedAfter) {
        if (item.last_updated < filters.lastUpdatedAfter) {
          return false;
        }
      }

      // Has plugs filter
      if (
        filters.hasPlugs !== undefined &&
        item.has_plugs !== filters.hasPlugs
      ) {
        return false;
      }

      // Overlay-friendly filter
      if (
        filters.overlayFriendly !== undefined &&
        item.overlay_friendly !== filters.overlayFriendly
      ) {
        return false;
      }

      return true;
    });
  }

  return results;
}

/**
 * Sort search results
 *
 * @param results - Search results to sort
 * @param order - Sort order
 * @returns Sorted results
 */
export function sortResults(
  results: SearchResult[],
  order: SortOrder,
): SearchResult[] {
  const sorted = [...results];

  switch (order) {
    case "most-copied-7d":
      sorted.sort((a, b) => {
        // Primary: copies_7d descending
        const diff = b.item.stats.copies_7d - a.item.stats.copies_7d;
        if (diff !== 0) return diff;
        // Secondary: search score ascending (lower = better)
        return a.score - b.score;
      });
      break;

    case "trending":
      // Trending = weighted combination of copies_7d and search relevance
      sorted.sort((a, b) => {
        const trendingScoreA =
          a.item.stats.copies_7d * 0.7 + (1 - a.score) * 0.3;
        const trendingScoreB =
          b.item.stats.copies_7d * 0.7 + (1 - b.score) * 0.3;
        return trendingScoreB - trendingScoreA;
      });
      break;

    case "recently-updated":
      sorted.sort((a, b) => {
        // Primary: last_updated descending
        const diff = b.item.last_updated.localeCompare(a.item.last_updated);
        if (diff !== 0) return diff;
        // Secondary: search score ascending
        return a.score - b.score;
      });
      break;

    case "name-asc":
      sorted.sort((a, b) => {
        // Primary: name ascending (case-insensitive)
        const diff = a.item.name
          .toLowerCase()
          .localeCompare(b.item.name.toLowerCase());
        if (diff !== 0) return diff;
        // Secondary: search score ascending
        return a.score - b.score;
      });
      break;

    default:
      // Default: sort by search score (ascending, lower = better)
      sorted.sort((a, b) => a.score - b.score);
  }

  return sorted;
}

/**
 * Get unique tools from search index
 *
 * @param entries - Search index entries
 * @returns Sorted unique tool names
 */
export function getUniqueTools(entries: SearchIndexEntry[]): string[] {
  const tools = new Set<string>();
  entries.forEach((entry) => {
    entry.compatible_tools.forEach((tool) => tools.add(tool));
  });
  return Array.from(tools).sort();
}

/**
 * Get unique categories from search index
 *
 * @param entries - Search index entries
 * @returns Sorted unique category names
 */
export function getUniqueCategories(entries: SearchIndexEntry[]): string[] {
  const categories = new Set<string>();
  entries.forEach((entry) => {
    entry.categories.forEach((cat) => categories.add(cat));
  });
  return Array.from(categories).sort();
}

/**
 * Get unique licenses from search index
 *
 * @param entries - Search index entries
 * @returns Sorted unique license identifiers
 */
export function getUniqueLicenses(entries: SearchIndexEntry[]): string[] {
  const licenses = new Set<string>();
  entries.forEach((entry) => {
    licenses.add(entry.license);
  });
  return Array.from(licenses).sort();
}
