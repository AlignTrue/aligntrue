"use client";

import { useState } from "react";
import { trackShareLinkCopy } from "@/lib/analytics";

interface ShareButtonProps {
  packSlug: string;
  packName: string;
  className?: string;
}

export function ShareButton({
  packSlug,
  packName,
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Generate URL with UTM parameters
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${baseUrl}/catalog/${packSlug}?utm_source=share&utm_medium=copy`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      // Track share event
      trackShareLinkCopy(packSlug, shareUrl);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy share link:", error);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${className}`}
      style={{
        backgroundColor: copied
          ? "var(--bgColor-success-emphasis)"
          : "var(--bgColor-muted)",
        color: copied ? "var(--fgColor-onEmphasis)" : "var(--fgColor-default)",
      }}
      onMouseEnter={(e) => {
        if (!copied) {
          e.currentTarget.style.backgroundColor =
            "var(--bgColor-neutral-muted)";
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          e.currentTarget.style.backgroundColor = "var(--bgColor-muted)";
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid var(--focus-outlineColor)";
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
      aria-label={`Share ${packName}`}
    >
      {copied ? (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          <span>Share</span>
        </>
      )}
    </button>
  );
}
