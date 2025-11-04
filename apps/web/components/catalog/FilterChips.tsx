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
        <label
          className="text-sm font-medium"
          style={{ color: "var(--fgColor-default)" }}
        >
          {label}
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs transition-colors"
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
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                backgroundColor: isSelected
                  ? "var(--bgColor-accent-emphasis)"
                  : "var(--bgColor-muted)",
                color: isSelected
                  ? "var(--fgColor-onEmphasis)"
                  : "var(--fgColor-default)",
              }}
              onMouseEnter={(e) => {
                if (isSelected) {
                  e.currentTarget.style.opacity = "0.9";
                } else {
                  e.currentTarget.style.backgroundColor =
                    "var(--bgColor-neutral-muted)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = isSelected
                  ? "var(--bgColor-accent-emphasis)"
                  : "var(--bgColor-muted)";
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline =
                  "2px solid var(--focus-outlineColor)";
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
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
