/**
 * SiteHeader Component
 *
 * Unified header for AlignTrue homepage and docs site.
 * Provides logo, navigation links, and theme toggle.
 */

"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AlignTrueLogo } from "./AlignTrueLogo";

interface SiteHeaderProps {
  /**
   * Whether to show navigation links (Docs, Catalog, GitHub)
   * Default: true
   */
  showNavigation?: boolean;

  /**
   * Whether to show theme toggle button
   * Default: true
   */
  showThemeToggle?: boolean;

  /**
   * Additional CSS class names
   */
  className?: string;
}

export function SiteHeader({
  showNavigation = true,
  showThemeToggle = true,
  className = "",
}: SiteHeaderProps) {
  return (
    <header
      className={className}
      style={{
        borderBottom: "1px solid var(--border-color)",
        padding: "1rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlignTrueLogo size="md" />
        </div>
        {showNavigation && (
          <nav style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <a
              href="/docs"
              style={{
                fontSize: "0.875rem",
                textDecoration: "none",
                color: "var(--fg-default)",
              }}
            >
              Docs
            </a>
            <a
              href="/docs/catalog/available-packs"
              style={{
                fontSize: "0.875rem",
                textDecoration: "none",
                color: "var(--fg-default)",
              }}
            >
              Catalog
            </a>
            <a
              href="https://github.com/AlignTrue/aligntrue"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "0.875rem",
                textDecoration: "none",
                color: "var(--fg-default)",
              }}
            >
              GitHub
            </a>
            {showThemeToggle && <ThemeToggle />}
          </nav>
        )}
      </div>
    </header>
  );
}

/**
 * ThemeToggle Component
 *
 * Button to toggle between light and dark themes.
 * Handles hydration safely with mounted state.
 */
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      style={{
        padding: "0.375rem",
        border: "1px solid var(--border-color)",
        borderRadius: "0.375rem",
        backgroundColor: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "🌞" : "🌙"}
    </button>
  );
}
