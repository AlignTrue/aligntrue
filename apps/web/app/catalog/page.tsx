/**
 * Catalog list page (Phase 4, Session 2)
 *
 * Discovery page with search, filters, sort, and pack cards.
 * Loads search_v1.json client-side and uses Fuse.js for fuzzy search.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import {
  loadSearchIndex,
  createSearchInstance,
  searchCatalog,
  sortResults,
  getUniqueTools,
  getUniqueCategories,
  getUniqueLicenses,
  type SearchIndexEntry,
  type SearchFilters,
  type SortOrder,
} from "@/lib/search";
import { trackCatalogSearch } from "@/lib/analytics";
import { FilterChips } from "@/components/catalog/FilterChips";
import { AdvancedFilters } from "@/components/catalog/AdvancedFilters";
import { PackCard } from "@/components/catalog/PackCard";
import type Fuse from "fuse.js";

/**
 * Catalog page component
 */
export default function CatalogPage() {
  // Search index state
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[] | null>(
    null,
  );
  const [fuseInstance, setFuseInstance] =
    useState<Fuse<SearchIndexEntry> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLicense, setSelectedLicense] = useState<string | undefined>();
  const [lastUpdatedAfter, setLastUpdatedAfter] = useState<
    string | undefined
  >();
  const [hasPlugs, setHasPlugs] = useState<boolean | undefined>();
  const [overlayFriendly, setOverlayFriendly] = useState<boolean | undefined>();
  const [sortOrder, setSortOrder] = useState<SortOrder>("most-copied-7d");

  // Load search index on mount
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        console.log("[Catalog] Starting to load search index");
        setIsLoading(true);
        setError(null);

        // Load search_v1.json (adjust path for production)
        const index = await loadSearchIndex("/catalog/search_v1.json");

        if (!mounted) {
          console.log("[Catalog] Component unmounted, aborting state update");
          return;
        }

        console.log(`[Catalog] Loaded ${index.entries.length} entries`);
        setSearchIndex(index.entries);
        setFuseInstance(createSearchInstance(index.entries));
        console.log("[Catalog] Search index initialized successfully");
      } catch (err) {
        if (!mounted) return;

        console.error("[Catalog] Failed to load search index:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Catalog index unavailable. Please check back later.";
        setError(errorMessage);
      } finally {
        if (mounted) {
          console.log("[Catalog] Setting loading to false");
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      console.log("[Catalog] Component unmounting");
      mounted = false;
    };
  }, []);

  // Compute unique filter options
  const filterOptions = useMemo(() => {
    if (!searchIndex) {
      return { tools: [], categories: [], licenses: [] };
    }

    return {
      tools: getUniqueTools(searchIndex),
      categories: getUniqueCategories(searchIndex),
      licenses: getUniqueLicenses(searchIndex),
    };
  }, [searchIndex]);

  // Search and filter results
  const searchResults = useMemo(() => {
    if (!fuseInstance || !searchIndex) {
      return [];
    }

    const filters: SearchFilters = {
      tools: selectedTools.length > 0 ? selectedTools : undefined,
      categories:
        selectedCategories.length > 0 ? selectedCategories : undefined,
      license: selectedLicense,
      lastUpdatedAfter,
      hasPlugs,
      overlayFriendly,
    };

    const results = searchCatalog(fuseInstance, searchQuery, filters);
    const sorted = sortResults(results, sortOrder);

    // Track search if there's a query
    if (searchQuery.trim()) {
      trackCatalogSearch(searchQuery, sorted.length);
    }

    return sorted;
  }, [
    fuseInstance,
    searchIndex,
    searchQuery,
    selectedTools,
    selectedCategories,
    selectedLicense,
    lastUpdatedAfter,
    hasPlugs,
    overlayFriendly,
    sortOrder,
  ]);

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchQuery("");
    setSelectedTools([]);
    setSelectedCategories([]);
    setSelectedLicense(undefined);
    setLastUpdatedAfter(undefined);
    setHasPlugs(undefined);
    setOverlayFriendly(undefined);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedTools.length > 0 ||
    selectedCategories.length > 0 ||
    selectedLicense !== undefined ||
    lastUpdatedAfter !== undefined ||
    hasPlugs !== undefined ||
    overlayFriendly !== undefined;

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading catalog...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Failed to load catalog
          </h2>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          AlignTrue Catalog
        </h1>
        <p className="text-lg text-neutral-600">
          Discover AI-native rules and alignment packs
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <label htmlFor="catalog-search" className="sr-only">
          Search catalog
        </label>
        <input
          id="catalog-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search packs by name, description, or tags..."
          className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-neutral-400"
          aria-label="Search catalog by name, description, or tags"
        />
      </div>

      {/* Layout: filters sidebar + results */}
      <div className="flex gap-8">
        {/* Filters sidebar */}
        <aside
          className="w-64 flex-shrink-0 space-y-6"
          aria-label="Catalog filters"
        >
          {/* Tool filters */}
          <FilterChips
            options={filterOptions.tools}
            selected={selectedTools}
            onChange={setSelectedTools}
            label="Tools"
            ariaLabel="Filter by compatible tools"
          />

          {/* Category filters */}
          <FilterChips
            options={filterOptions.categories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            label="Categories"
            ariaLabel="Filter by categories"
          />

          {/* Advanced filters */}
          <AdvancedFilters
            licenses={filterOptions.licenses}
            selectedLicense={selectedLicense}
            onLicenseChange={setSelectedLicense}
            lastUpdatedAfter={lastUpdatedAfter}
            onLastUpdatedChange={setLastUpdatedAfter}
            hasPlugs={hasPlugs}
            onHasPlugsChange={setHasPlugs}
            overlayFriendly={overlayFriendly}
            onOverlayFriendlyChange={setOverlayFriendly}
            defaultCollapsed={true}
          />

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="w-full px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-400"
              aria-label="Clear all filters"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* Results area */}
        <main className="flex-1 min-w-0">
          {/* Sort and count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-neutral-600">
              {searchResults.length}{" "}
              {searchResults.length === 1 ? "pack" : "packs"}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-order" className="text-sm text-neutral-600">
                Sort by:
              </label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="px-3 py-1.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
                aria-label="Sort packs by"
              >
                <option value="most-copied-7d">Most copied (7d)</option>
                <option value="trending">Trending</option>
                <option value="recently-updated">Recently updated</option>
                <option value="name-asc">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Pack cards grid */}
          {searchResults.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-neutral-600 mb-2">No packs found</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-sm text-neutral-500 hover:text-neutral-700 underline focus:outline-none"
                >
                  Clear filters to see all packs
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {searchResults.map((result) => (
                <PackCard
                  key={result.item.id}
                  pack={result.item as unknown as CatalogEntryExtended}
                  onClick={(pack) => {
                    window.location.href = `/catalog/${pack.slug}`;
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
