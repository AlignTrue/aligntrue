/**
 * Copy block component (Phase 4, Session 3)
 *
 * Generates CLI install commands with plug substitution.
 * For packs with required plugs, shows input form with live preview.
 */

"use client";

import { useState, useMemo } from "react";
import type { CatalogEntryExtended } from "@aligntrue/schema";

export interface CopyBlockProps {
  /** Pack data */
  pack: CatalogEntryExtended;
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
 * Generate install command with optional plug values
 */
function generateInstallCommand(
  pack: CatalogEntryExtended,
  plugValues: Record<string, string>,
): string {
  // Base install command
  const baseCmd = `aligntrue add ${pack.id}@${pack.version} --from=catalog_web`;

  // If no required plugs, return base command
  if (!pack.required_plugs || pack.required_plugs.length === 0) {
    return baseCmd;
  }

  // Add plug set commands
  const plugCmds = pack.required_plugs
    .map((plug) => {
      const value = plugValues[plug.key] || plug.default || "";
      if (!value) return null;
      return `aln plugs set ${plug.key} "${value}"`;
    })
    .filter(Boolean);

  if (plugCmds.length === 0) {
    return baseCmd;
  }

  return `${baseCmd}\n\n# Configure required plugs:\n${plugCmds.join("\n")}`;
}

/**
 * Copy block component
 */
export function CopyBlock({ pack }: CopyBlockProps) {
  // Track plug values for required plugs
  const [plugValues, setPlugValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (pack.required_plugs) {
      pack.required_plugs.forEach((plug) => {
        initial[plug.key] = plug.default || "";
      });
    }
    return initial;
  });

  const [copySuccess, setCopySuccess] = useState(false);

  // Generate install command with current plug values
  const installCommand = useMemo(
    () => generateInstallCommand(pack, plugValues),
    [pack, plugValues],
  );

  // Handle copy
  const handleCopy = async () => {
    const success = await copyToClipboard(installCommand);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Handle plug value change
  const handlePlugChange = (key: string, value: string) => {
    setPlugValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const hasRequiredPlugs =
    pack.required_plugs && pack.required_plugs.length > 0;

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">
        Installation
      </h2>

      {/* Required plugs form */}
      {hasRequiredPlugs && (
        <div className="mb-4 space-y-3">
          <p className="text-sm text-neutral-600 mb-2">
            Configure required plugs:
          </p>
          {pack.required_plugs!.map((plug) => (
            <div key={plug.key}>
              <label
                htmlFor={`plug-${plug.key}`}
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                {plug.key}
                {plug.type && (
                  <span className="ml-2 text-xs text-neutral-500">
                    ({plug.type})
                  </span>
                )}
              </label>
              <input
                id={`plug-${plug.key}`}
                type="text"
                value={plugValues[plug.key] || ""}
                onChange={(e) => handlePlugChange(plug.key, e.target.value)}
                placeholder={plug.default || "Enter value..."}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
                aria-describedby={`plug-${plug.key}-desc`}
              />
              {plug.description && (
                <p
                  id={`plug-${plug.key}-desc`}
                  className="mt-1 text-xs text-neutral-500"
                >
                  {plug.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live preview of command */}
      <div className="mb-4">
        <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 font-mono text-sm overflow-x-auto">
          <pre className="whitespace-pre-wrap break-all">{installCommand}</pre>
        </div>
      </div>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className={`
          w-full px-4 py-2 rounded-md text-sm font-medium transition-colors
          focus:outline-none focus:ring-2 focus:ring-neutral-400
          ${
            copySuccess
              ? "bg-green-600 text-white"
              : "bg-neutral-900 text-white hover:bg-neutral-800"
          }
        `}
        aria-label="Copy install command to clipboard"
      >
        {copySuccess ? "✓ Copied!" : "Copy install command"}
      </button>

      {/* Link to CLI docs */}
      <div className="mt-4 pt-4 border-t border-neutral-200">
        <p className="text-xs text-neutral-600">
          Need help?{" "}
          <a
            href="/docs/quickstart"
            className="text-neutral-700 hover:text-neutral-900 underline focus:outline-none"
          >
            View CLI installation guide →
          </a>
        </p>
      </div>
    </div>
  );
}
