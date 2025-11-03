/**
 * Pack card component for catalog discovery (Phase 4, Session 2)
 *
 * Displays catalog entry with metadata, trust signals, and customization hints.
 * Supports keyboard navigation and ARIA labels.
 */

"use client";

import type { CatalogEntryExtended } from "@aligntrue/schema";

export interface PackCardProps {
  /** Catalog entry data */
  pack: CatalogEntryExtended;
  /** Optional click handler */
  onClick?: (pack: CatalogEntryExtended) => void;
}

/**
 * Format date for display (e.g., "2025-10-31" → "Oct 31, 2025")
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Badge component for small inline labels
 */
function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "info";
}) {
  const colors = {
    default: "bg-neutral-100 text-neutral-700",
    success: "bg-green-100 text-green-800",
    info: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

/**
 * Pack card component
 */
export function PackCard({ pack, onClick }: PackCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(pack);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && onClick) {
      e.preventDefault();
      onClick(pack);
    }
  };

  const isInteractive = !!onClick;

  return (
    <div
      className={`
        bg-white border border-neutral-200 rounded-lg p-6 shadow-sm
        transition-shadow hover:shadow-md
        ${isInteractive ? "cursor-pointer" : ""}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : "article"}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `View details for ${pack.name}` : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-neutral-900 truncate">
            {pack.name}
          </h3>
          <p className="text-sm text-neutral-500 mt-0.5">v{pack.version}</p>
        </div>
        <div className="flex flex-col items-end gap-1 ml-4">
          {pack.source_linked && <Badge variant="success">Source Linked</Badge>}
          {pack.overlay_friendly && (
            <Badge variant="info">Overlay Friendly</Badge>
          )}
          {pack.attribution?.type === "community" && (
            <Badge variant="info">Community</Badge>
          )}
          {pack.source_repo && (
            <a
              href={pack.source_repo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Source code available for review"
              aria-label="View source repository"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Source
            </a>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-neutral-700 mb-4 line-clamp-2">
        {pack.description}
      </p>

      {/* Categories and tools */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {pack.categories.slice(0, 3).map((cat) => (
          <Badge key={cat}>{cat.replace(/-/g, " ")}</Badge>
        ))}
        {pack.categories.length > 3 && (
          <Badge>+{pack.categories.length - 3} more</Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-neutral-500 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-3">
          <span title="Copies in last 7 days">
            {pack.stats.copies_7d > 0
              ? `${pack.stats.copies_7d} copies/7d`
              : "New"}
          </span>
          <span>•</span>
          <span>{pack.license}</span>
          {pack.has_plugs && (
            <>
              <span>•</span>
              <span>{pack.required_plugs_count} plugs</span>
            </>
          )}
        </div>
        <span title={`Last updated: ${pack.last_updated}`}>
          {formatDate(pack.last_updated)}
        </span>
      </div>

      {/* Maintainer info */}
      <div className="flex items-center gap-2 mt-3 text-xs text-neutral-600">
        <span className="font-medium">{pack.maintainer.name}</span>
        {pack.maintainer.github && (
          <>
            <span>•</span>
            <a
              href={`https://github.com/${pack.maintainer.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
              aria-label={`View ${pack.maintainer.name} on GitHub`}
            >
              @{pack.maintainer.github}
            </a>
          </>
        )}
      </div>

      {/* Compatible tools */}
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <div className="flex flex-wrap gap-1.5">
          {pack.compatible_tools.slice(0, 4).map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-50 text-xs text-neutral-600"
              title={`Compatible with ${tool}`}
            >
              {tool}
            </span>
          ))}
          {pack.compatible_tools.length > 4 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-50 text-xs text-neutral-600">
              +{pack.compatible_tools.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
