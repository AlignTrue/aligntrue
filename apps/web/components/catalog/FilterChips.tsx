/**
 * Filter chips component for catalog discovery (Phase 4, Session 2)
 *
 * Multi-select tool and category filters with chip UI.
 * Supports keyboard navigation and ARIA labels.
 */

"use client";

import { trackCatalogFilter } from "@/lib/analytics";

export interface FilterChipsProps {
  /** Available options */
  options: string[];
  /** Selected options */
  selected: string[];
  /** Selection change handler */
  onChange: (selected: string[]) => void;
  /** Label for filter group */
  label: string;
  /** Optional aria-label override */
  ariaLabel?: string;
  /** Filter type for analytics (tools, categories, tags) */
  filterType?: "status" | "namespace" | "tag";
}

/**
 * Format option for display (e.g., "cursor" → "Cursor", "claude-code" → "Claude Code")
 */
function formatOption(option: string): string {
  return option
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Filter chips component with multi-select
 */
export function FilterChips({
  options,
  selected,
  onChange,
  label,
  ariaLabel,
  filterType = "tag",
}: FilterChipsProps) {
  const handleToggle = (option: string) => {
    const willBeSelected = !selected.includes(option);

    if (willBeSelected) {
      onChange([...selected, option]);
      trackCatalogFilter(filterType, option);
    } else {
      onChange(selected.filter((s) => s !== option));
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div
      className="space-y-2"
      role="group"
      aria-label={ariaLabel || `${label} filters`}
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700">{label}</label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-neutral-500 hover:text-neutral-700 focus:outline-none focus:underline"
            aria-label={`Clear all ${label.toLowerCase()} filters`}
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="list">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleToggle(option)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium
                transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400
                ${
                  isSelected
                    ? "bg-neutral-900 text-white hover:bg-neutral-800"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }
              `}
              role="listitem"
              aria-pressed={isSelected}
              aria-label={`${isSelected ? "Remove" : "Add"} ${formatOption(option)} filter`}
            >
              {formatOption(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
