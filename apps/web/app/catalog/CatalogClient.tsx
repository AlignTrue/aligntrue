/**
 * Catalog client component (Phase 4, Session 2 - Refactored for hybrid SSR)
 *
 * Discovery page with search, filters, sort, and pack cards.
 * Receives initial pack data from server component for immediate display.
 * Provides client-side search and filtering with Fuse.js.
 */

"use client";

import { useState, useMemo } from "react";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import {
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

interface CatalogClientProps {
  initialPacks: CatalogEntryExtended[];
}

/**
 * Catalog client component
 */
export function CatalogClient({ initialPacks }: CatalogClientProps) {
  // Initialize search index with server-provided data
  const [searchIndex] = useState<SearchIndexEntry[]>(
    initialPacks as unknown as SearchIndexEntry[],
  );
  const [fuseInstance] = useState<Fuse<SearchIndexEntry>>(
    createSearchInstance(initialPacks as unknown as SearchIndexEntry[]),
  );

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "var(--fgColor-default)" }}
        >
          AlignTrue Catalog
        </h1>
        <p className="text-lg" style={{ color: "var(--fgColor-muted)" }}>
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
          className="w-full px-4 py-3 rounded-lg text-base transition-colors"
          style={{
            backgroundColor: "var(--bgColor-default)",
            color: "var(--fgColor-default)",
            border: "1px solid var(--borderColor-default)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline =
              "2px solid var(--focus-outlineColor)";
            e.currentTarget.style.outlineOffset = "2px";
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = "none";
          }}
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
              className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--bgColor-muted)",
                color: "var(--fgColor-default)",
                border: "1px solid var(--borderColor-default)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--bgColor-neutral-muted)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bgColor-muted)";
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline =
                  "2px solid var(--focus-outlineColor)";
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
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
            <p className="text-sm" style={{ color: "var(--fgColor-muted)" }}>
              {searchResults.length}{" "}
              {searchResults.length === 1 ? "pack" : "packs"}
            </p>
            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-order"
                className="text-sm"
                style={{ color: "var(--fgColor-muted)" }}
              >
                Sort by:
              </label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{
                  backgroundColor: "var(--bgColor-default)",
                  color: "var(--fgColor-default)",
                  border: "1px solid var(--borderColor-default)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline =
                    "2px solid var(--focus-outlineColor)";
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
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
              <p className="mb-2" style={{ color: "var(--fgColor-muted)" }}>
                No packs found
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-sm underline transition-colors"
                  style={{ color: "var(--fgColor-accent)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline =
                      "2px solid var(--focus-outlineColor)";
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
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
