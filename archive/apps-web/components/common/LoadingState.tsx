/**
 * Loading state components (Phase 4, Session 6)
 *
 * Skeleton loaders and loading spinners for catalog pages.
 */

/**
 * Loading spinner
 */
export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-12 w-12 border-4",
    lg: "h-16 w-16 border-4",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-neutral-200 border-t-neutral-900 ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

/**
 * Loading state for catalog list page
 */
export function CatalogListLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-9 bg-neutral-200 rounded w-64 mb-2 animate-pulse" />
        <div className="h-6 bg-neutral-200 rounded w-96 animate-pulse" />
      </div>

      {/* Search skeleton */}
      <div className="mb-6">
        <div className="h-12 bg-neutral-200 rounded-lg w-full animate-pulse" />
      </div>

      {/* Layout: filters + results */}
      <div className="flex gap-8">
        {/* Filters skeleton */}
        <aside className="w-64 flex-shrink-0 space-y-6">
          <div className="space-y-2">
            <div className="h-5 bg-neutral-200 rounded w-24 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 bg-neutral-200 rounded-full w-20 animate-pulse"
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Results skeleton */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div className="h-5 bg-neutral-200 rounded w-24 animate-pulse" />
            <div className="h-9 bg-neutral-200 rounded w-48 animate-pulse" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white border border-neutral-200 rounded-lg p-6 animate-pulse"
              >
                <div className="h-6 bg-neutral-200 rounded w-48 mb-2" />
                <div className="h-4 bg-neutral-200 rounded w-full mb-4" />
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Loading state for pack detail page
 */
export function PackDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="h-9 bg-neutral-200 rounded w-80 mb-2" />
            <div className="h-6 bg-neutral-200 rounded w-24" />
          </div>
          <div className="flex gap-2 ml-6">
            <div className="h-10 bg-neutral-200 rounded-md w-24" />
            <div className="h-10 bg-neutral-200 rounded-md w-32" />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="h-4 bg-neutral-200 rounded w-full" />
          <div className="h-4 bg-neutral-200 rounded w-5/6" />
        </div>

        <div className="h-px bg-neutral-200 my-6" />

        <div className="flex items-center gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 bg-neutral-200 rounded w-24" />
          ))}
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-neutral-200 rounded-lg h-96" />
        </div>
        <div className="space-y-8">
          <div className="bg-neutral-200 rounded-lg h-64" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state for search results
 */
export function SearchResultsLoading({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-neutral-200 rounded-lg p-6 animate-pulse"
        >
          <div className="h-6 bg-neutral-200 rounded w-48 mb-2" />
          <div className="h-4 bg-neutral-200 rounded w-full mb-2" />
          <div className="h-4 bg-neutral-200 rounded w-3/4 mb-4" />
          <div className="flex gap-2">
            <div className="h-6 bg-neutral-200 rounded w-16" />
            <div className="h-6 bg-neutral-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
