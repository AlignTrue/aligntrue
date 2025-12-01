"use client";

import { useState, useEffect } from "react";
import { GitHubIcon } from "./GitHubIcon";

/**
 * BetaBanner Component
 *
 * Dismissible beta status banner for the AlignTrue website.
 * Displays on homepage and docs site with link to GitHub for updates.
 * Dismissal is remembered via localStorage.
 */
export function BetaBanner() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set CSS custom property for banner height
    document.documentElement.style.setProperty("--banner-height", "48px");
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .beta-banner {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .beta-banner-content {
            flex: none !important;
            min-width: auto !important;
            width: 100% !important;
            flex-wrap: wrap !important;
          }
        }
      `}</style>
      <div
        className="beta-banner"
        style={{
          backgroundColor: "#0d47a1",
          color: "white",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          flexWrap: "wrap",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: "0.875rem",
          fontWeight: "500",
        }}
      >
        <div
          className="beta-banner-content"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flex: 1,
            minWidth: "200px",
            justifyContent: "center",
          }}
        >
          <span>🚀 AlignTrue is in beta. </span>
          <a
            href="https://github.com/AlignTrue/aligntrue"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#64b5f6",
              textDecoration: "underline",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontWeight: "600",
            }}
            aria-label="Follow updates on GitHub"
          >
            Follow on GitHub
            <GitHubIcon size={16} style={{ display: "inline" }} />
          </a>
        </div>
      </div>
    </>
  );
}
