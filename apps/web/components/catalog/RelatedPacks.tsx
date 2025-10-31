/**
 * Related packs component (Phase 4, Session 3)
 *
 * Shows 3-4 related packs based on shared categories and tools.
 * Uses compact card layout with click to navigate.
 */

"use client";

import { useMemo } from "react";
import type { CatalogEntryExtended } from "@aligntrue/schema";

export interface RelatedPacksProps {
  /** Current pack being viewed */
  currentPack: CatalogEntryExtended;
  /** All catalog packs */
  allPacks: CatalogEntryExtended[];
  /** Maximum number of related packs to show */
  maxPacks?: number;
}

/**
 * Calculate similarity score between two packs
 */
function calculateSimilarity(
  pack1: CatalogEntryExtended,
  pack2: CatalogEntryExtended,
): number {
  let score = 0;

  // Shared categories (weight: 3)
  const sharedCategories = pack1.categories.filter((cat) =>
    pack2.categories.includes(cat),
  );
  score += sharedCategories.length * 3;

  // Shared tools (weight: 2)
  const sharedTools = pack1.compatible_tools.filter((tool) =>
    pack2.compatible_tools.includes(tool),
  );
  score += sharedTools.length * 2;

  // Same maintainer (weight: 1)
  if (
    pack1.maintainer.github &&
    pack1.maintainer.github === pack2.maintainer.github
  ) {
    score += 1;
  }

  return score;
}

/**
 * Find related packs
 */
function findRelatedPacks(
  currentPack: CatalogEntryExtended,
  allPacks: CatalogEntryExtended[],
  maxPacks: number,
): CatalogEntryExtended[] {
  // Filter out current pack
  const otherPacks = allPacks.filter((p) => p.id !== currentPack.id);

  // Calculate similarity scores
  const scored = otherPacks.map((pack) => ({
    pack,
    score: calculateSimilarity(currentPack, pack),
  }));

  // Sort by score (descending) and take top N
  return scored
    .filter((item) => item.score > 0) // Only include packs with some similarity
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPacks)
    .map((item) => item.pack);
}

/**
 * Compact pack card for related packs
 */
function CompactPackCard({
  pack,
  onClick,
}: {
  pack: CatalogEntryExtended;
  onClick: (pack: CatalogEntryExtended) => void;
}) {
  const handleClick = () => {
    onClick(pack);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(pack);
    }
  };

  return (
    <div
      className="bg-white border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${pack.name}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-neutral-900 truncate flex-1">
          {pack.name}
        </h3>
        <span className="text-xs text-neutral-500 ml-2 flex-shrink-0">
          v{pack.version}
        </span>
      </div>
      <p className="text-xs text-neutral-600 line-clamp-2 mb-2">
        {pack.description}
      </p>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {pack.stats.copies_7d > 0
            ? `${pack.stats.copies_7d} copies/7d`
            : "New"}
        </span>
        <span>{pack.license}</span>
      </div>
    </div>
  );
}

/**
 * Related packs component
 */
export function RelatedPacks({
  currentPack,
  allPacks,
  maxPacks = 4,
}: RelatedPacksProps) {
  // Find related packs
  const relatedPacks = useMemo(
    () => findRelatedPacks(currentPack, allPacks, maxPacks),
    [currentPack, allPacks, maxPacks],
  );

  // Handle pack click - navigate to detail page
  const handlePackClick = (pack: CatalogEntryExtended) => {
    window.location.href = `/catalog/${pack.slug}`;
  };

  // If no related packs, don't render anything
  if (relatedPacks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">
        Related packs
      </h2>
      <div className="space-y-3">
        {relatedPacks.map((pack) => (
          <CompactPackCard
            key={pack.id}
            pack={pack}
            onClick={handlePackClick}
          />
        ))}
      </div>
    </div>
  );
}
