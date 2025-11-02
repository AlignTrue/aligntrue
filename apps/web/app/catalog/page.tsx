/**
 * Catalog list page (Phase 4, Session 2 - Refactored for hybrid SSR)
 *
 * Server component that fetches catalog data and passes to client component.
 * Provides immediate content for SEO while enabling rich client-side search.
 */

import { loadCatalogIndex } from "@/lib/catalog";
import { CatalogClient } from "./CatalogClient";

/**
 * Catalog page - Server component that fetches data and passes to client
 */
export default async function CatalogPage() {
  // Server-side data fetch
  const catalogData = await loadCatalogIndex();

  if (!catalogData || !catalogData.packs) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Failed to load catalog
          </h2>
          <p className="text-sm text-red-700">
            Catalog index unavailable. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  // Render client component with server data
  return <CatalogClient initialPacks={catalogData.packs} />;
}
