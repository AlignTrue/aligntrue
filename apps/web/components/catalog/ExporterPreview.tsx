/**
 * Exporter preview component (Phase 4, Session 3)
 *
 * Tabbed interface for viewing pre-computed exporter previews
 * with syntax highlighting, provenance metadata, and copy functionality.
 */

"use client";

import { useState } from "react";
import type {
  CatalogEntryExtended,
  ExporterPreview as ExporterPreviewType,
} from "@aligntrue/schema";
import {
  trackExporterTabSwitch,
  trackCopyExporterPreview,
} from "@/lib/analytics";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export interface ExporterPreviewProps {
  /** Pack data with exporter previews */
  pack: CatalogEntryExtended;
}

/**
 * Format date for provenance display
 */
function formatProvenanceDate(isoDate: string): string {
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
 * Get language for syntax highlighting based on format
 */
function getLanguageForFormat(format: string): string {
  const mapping: Record<string, string> = {
    yaml: "yaml",
    "agents-md": "markdown",
    cursor: "markdown",
    warp: "markdown",
    "vscode-mcp": "json",
    "json-markers": "json",
  };
  return mapping[format] || "text";
}

/**
 * Get display name for exporter format
 */
function getFormatDisplayName(format: string): string {
  const names: Record<string, string> = {
    yaml: "YAML",
    "agents-md": "AGENTS.md",
    cursor: "Cursor",
    warp: "Warp",
    "vscode-mcp": "VS Code MCP",
    "json-markers": "JSON Markers",
  };
  return names[format] || format;
}

/**
 * Copy to clipboard helper
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

/**
 * Exporter preview component
 */
export function ExporterPreview({ pack }: ExporterPreviewProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>(
    pack.exporters[0]?.format || "yaml",
  );
  const [copySuccess, setCopySuccess] = useState(false);

  // Get current preview
  const currentPreview = pack.exporters.find(
    (exp) => exp.format === selectedFormat,
  );

  // Handle copy
  const handleCopy = async () => {
    if (!currentPreview) return;

    const success = await copyToClipboard(currentPreview.preview);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      // Track copy event
      trackCopyExporterPreview(pack.slug, selectedFormat);
    }
  };

  // Handle format switch
  const handleFormatSwitch = (newFormat: string) => {
    const oldFormat = selectedFormat;
    setSelectedFormat(newFormat);
    // Track format switch
    trackExporterTabSwitch(pack.slug, newFormat, oldFormat);
  };

  // Handle tab keyboard navigation
  const handleTabKeyDown = (e: React.KeyboardEvent, format: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleFormatSwitch(format);
    }
  };

  if (!currentPreview) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
        <p className="text-neutral-600">No previews available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      {/* Tab navigation */}
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div
          className="flex items-center gap-1 px-4 py-2 overflow-x-auto"
          role="tablist"
          aria-label="Exporter format tabs"
        >
          {pack.exporters.map((exp) => (
            <button
              key={exp.format}
              type="button"
              role="tab"
              aria-selected={exp.format === selectedFormat}
              aria-controls={`preview-${exp.format}`}
              id={`tab-${exp.format}`}
              onClick={() => handleFormatSwitch(exp.format)}
              onKeyDown={(e) => handleTabKeyDown(e, exp.format)}
              className={`
                px-4 py-2 text-sm font-medium rounded-md transition-colors
                focus:outline-none focus:ring-2 focus:ring-neutral-400
                ${
                  exp.format === selectedFormat
                    ? "bg-white text-neutral-900 border border-neutral-200"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }
              `}
            >
              {getFormatDisplayName(exp.format)}
            </button>
          ))}
        </div>
      </div>

      {/* Preview content */}
      <div
        role="tabpanel"
        id={`preview-${selectedFormat}`}
        aria-labelledby={`tab-${selectedFormat}`}
        className="relative"
      >
        {/* Copy button */}
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={handleCopy}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-neutral-400
              ${
                copySuccess
                  ? "bg-green-600 text-white"
                  : "bg-neutral-800 text-white hover:bg-neutral-700"
              }
            `}
            aria-label="Copy preview to clipboard"
          >
            {copySuccess ? "✓ Copied!" : "Copy"}
          </button>
        </div>

        {/* Syntax-highlighted preview */}
        <div className="overflow-x-auto">
          <SyntaxHighlighter
            language={getLanguageForFormat(selectedFormat)}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: "1.5rem",
              fontSize: "0.875rem",
              lineHeight: "1.5",
              borderRadius: 0,
            }}
            showLineNumbers
          >
            {currentPreview.preview}
          </SyntaxHighlighter>
        </div>

        {/* Provenance footer */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <div className="flex items-center gap-4">
              <span
                title={`Engine version: ${currentPreview.preview_meta.engine_version}`}
              >
                Engine v{currentPreview.preview_meta.engine_version}
              </span>
              <span>•</span>
              <span
                title={`Rendered: ${currentPreview.preview_meta.rendered_at}`}
              >
                Rendered{" "}
                {formatProvenanceDate(currentPreview.preview_meta.rendered_at)}
              </span>
              <span>•</span>
              <span
                title={`Canonical SHA: ${currentPreview.preview_meta.canonical_yaml_sha}`}
                className="font-mono"
              >
                {currentPreview.preview_meta.canonical_yaml_sha.slice(0, 8)}...
              </span>
            </div>
          </div>

          {/* Fidelity notes (if present) */}
          {currentPreview.preview_meta &&
          typeof currentPreview.preview_meta === "object" &&
          "fidelity_notes" in currentPreview.preview_meta &&
          currentPreview.preview_meta.fidelity_notes &&
          typeof currentPreview.preview_meta.fidelity_notes === "string" ? (
            <div className="mt-2 pt-2 border-t border-neutral-200">
              <p className="text-xs text-amber-700 font-medium mb-1">
                Fidelity notes:
              </p>
              <p className="text-xs text-neutral-700">
                {currentPreview.preview_meta.fidelity_notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
