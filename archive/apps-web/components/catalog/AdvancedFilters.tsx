/**
 * Advanced filters component for catalog discovery (Phase 4, Session 2)
 *
 * Additional filter controls: license, last updated, has plugs, overlay-friendly.
 * Collapsible accordion with toggle controls.
 */

"use client";

import { useState } from "react";

export interface AdvancedFiltersProps {
  /** Available license options */
  licenses: string[];
  /** Selected license (undefined = all) */
  selectedLicense?: string;
  /** License change handler */
  onLicenseChange: (license?: string) => void;

  /** Last updated filter (ISO 8601 date, undefined = all) */
  lastUpdatedAfter?: string;
  /** Last updated change handler */
  onLastUpdatedChange: (date?: string) => void;

  /** Has plugs filter (undefined = all) */
  hasPlugs?: boolean;
  /** Has plugs change handler */
  onHasPlugsChange: (hasPlugs?: boolean) => void;

  /** Overlay-friendly filter (undefined = all) */
  overlayFriendly?: boolean;
  /** Overlay-friendly change handler */
  onOverlayFriendlyChange: (overlayFriendly?: boolean) => void;

  /** Optional collapsed state (default: false) */
  defaultCollapsed?: boolean;
}

/**
 * Last updated preset options
 */
const LAST_UPDATED_PRESETS = [
  { label: "All time", value: undefined },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

/**
 * Calculate ISO date string for N days ago
 */
function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

/**
 * Advanced filters component
 */
export function AdvancedFilters({
  licenses,
  selectedLicense,
  onLicenseChange,
  lastUpdatedAfter,
  onLastUpdatedChange,
  hasPlugs,
  onHasPlugsChange,
  overlayFriendly,
  onOverlayFriendlyChange,
  defaultCollapsed = false,
}: AdvancedFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleLicenseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onLicenseChange(value === "all" ? undefined : value);
  };

  const handleLastUpdatedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onLastUpdatedChange(
      value === "all" ? undefined : getDaysAgo(parseInt(value, 10)),
    );
  };

  const handleHasPlugsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    onHasPlugsChange(checked ? true : undefined);
  };

  const handleOverlayFriendlyChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const checked = e.target.checked;
    onOverlayFriendlyChange(checked ? true : undefined);
  };

  const handleClearAll = () => {
    onLicenseChange(undefined);
    onLastUpdatedChange(undefined);
    onHasPlugsChange(undefined);
    onOverlayFriendlyChange(undefined);
  };

  const hasActiveFilters =
    selectedLicense !== undefined ||
    lastUpdatedAfter !== undefined ||
    hasPlugs !== undefined ||
    overlayFriendly !== undefined;

  return (
    <div className="border-t border-neutral-200 pt-4">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between text-sm font-medium text-neutral-700 hover:text-neutral-900 focus:outline-none focus:underline"
        aria-expanded={!isCollapsed}
        aria-controls="advanced-filters"
      >
        <span>Advanced filters</span>
        <span className="text-neutral-500">{isCollapsed ? "▼" : "▲"}</span>
      </button>

      {!isCollapsed && (
        <div id="advanced-filters" className="mt-4 space-y-4">
          {/* License filter */}
          <div>
            <label
              htmlFor="license-filter"
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              License
            </label>
            <select
              id="license-filter"
              value={selectedLicense || "all"}
              onChange={handleLicenseChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
              aria-label="Filter by license"
            >
              <option value="all">All licenses</option>
              {licenses.map((license) => (
                <option key={license} value={license}>
                  {license}
                </option>
              ))}
            </select>
          </div>

          {/* Last updated filter */}
          <div>
            <label
              htmlFor="last-updated-filter"
              className="block text-sm font-medium text-neutral-700 mb-1"
            >
              Last updated
            </label>
            <select
              id="last-updated-filter"
              value={lastUpdatedAfter ? "custom" : "all"}
              onChange={handleLastUpdatedChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
              aria-label="Filter by last updated"
            >
              {LAST_UPDATED_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.value || "all"}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* Boolean filters */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={hasPlugs === true}
                onChange={handleHasPlugsChange}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-neutral-400"
                aria-label="Filter packs with plugs"
              />
              <span className="text-sm text-neutral-700">Has plugs</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={overlayFriendly === true}
                onChange={handleOverlayFriendlyChange}
                className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-2 focus:ring-neutral-400"
                aria-label="Filter overlay-friendly packs"
              />
              <span className="text-sm text-neutral-700">Overlay-friendly</span>
            </label>
          </div>

          {/* Clear all button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm text-neutral-500 hover:text-neutral-700 focus:outline-none focus:underline"
              aria-label="Clear all advanced filters"
            >
              Clear advanced filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
