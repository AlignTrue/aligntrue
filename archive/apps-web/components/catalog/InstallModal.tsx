/**
 * Installation modal component (Phase 4, Session 5)
 *
 * Three-step installation instructions with copy buttons and YAML download fallback.
 * Includes accessibility features: ESC to close, focus trap, ARIA labels.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import {
  generateInstallCommands,
  formatCommandBlock,
  generateDownloadFilename,
  findExporterPreview,
  type InstallCommand,
} from "../../lib/install-commands";

export interface InstallModalProps {
  /** Pack to install */
  pack: CatalogEntryExtended;
  /** Modal open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
}

/**
 * Copy text to clipboard
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
 * Download text as file
 */
function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Installation modal component
 */
export function InstallModal({ pack, open, onClose }: InstallModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const commands = generateInstallCommands(pack);

  // Focus trap: focus close button when modal opens
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  // ESC key handler
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  // Copy individual command
  async function handleCopyCommand(index: number, command: string) {
    const success = await copyToClipboard(command);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }

  // Copy all commands
  async function handleCopyAll() {
    const block = formatCommandBlock(commands);
    const success = await copyToClipboard(block);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }

  // Download YAML fallback
  function handleDownload() {
    const yamlContent = findExporterPreview(pack, "yaml");
    if (yamlContent) {
      const filename = generateDownloadFilename(pack);
      downloadFile(filename, yamlContent);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
    >
      {/* Modal content */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-start justify-between">
          <div>
            <h2
              id="install-modal-title"
              className="text-xl font-semibold text-neutral-900"
            >
              Install {pack.name}
            </h2>
            <p className="text-sm text-neutral-600 mt-1">
              Follow these steps to add this pack to your project
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Installation steps */}
          <div className="space-y-4">
            {commands.map((cmd, index) => (
              <InstallStep
                key={index}
                step={index + 1}
                command={cmd}
                copied={copiedIndex === index}
                onCopy={() => handleCopyCommand(index, cmd.command)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-200">
            <button
              onClick={handleCopyAll}
              className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium"
            >
              {copiedAll ? "✓ Copied all!" : "Copy all commands"}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 px-4 py-2 bg-white text-neutral-900 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
            >
              Download YAML
            </button>
          </div>

          {/* Help text */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <p className="text-sm text-neutral-700">
              <strong>Note:</strong> The{" "}
              <code className="px-1 py-0.5 bg-neutral-200 rounded text-xs">
                --from=catalog_web
              </code>{" "}
              flag helps us measure catalog usage. This is transparent tracking
              - no personal data is collected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual installation step component
 */
function InstallStep({
  step,
  command,
  copied,
  onCopy,
}: {
  step: number;
  command: InstallCommand;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3">
          <span
            className={`
              flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${command.required ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600"}
            `}
          >
            {step}
          </span>
          <div>
            <h3 className="font-medium text-neutral-900">
              {command.label}
              {!command.required && (
                <span className="ml-2 text-xs text-neutral-500 font-normal">
                  (optional)
                </span>
              )}
            </h3>
            {command.help && (
              <p className="text-sm text-neutral-600 mt-1">{command.help}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 relative">
        <pre className="bg-neutral-900 text-neutral-100 text-sm p-3 rounded overflow-x-auto">
          <code>{command.command}</code>
        </pre>
        <button
          onClick={onCopy}
          className="absolute top-2 right-2 px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs rounded transition-colors"
          aria-label={`Copy ${command.label} command`}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
