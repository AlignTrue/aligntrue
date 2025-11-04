/**
 * SiteHeader Component
 *
 * Unified header for AlignTrue homepage and docs site.
 * Provides logo, navigation links, and theme toggle.
 * Includes mobile-responsive hamburger menu.
 */

"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Sun, Moon } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when window is resized to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        className={className}
        style={{
          borderBottom: "1px solid var(--border-color)",
          padding: "1rem 1.5rem",
          position: "relative",
          zIndex: 50,
          backgroundColor: "var(--bg-default)",
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
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              textDecoration: "none",
            }}
            aria-label="AlignTrue home"
          >
            <AlignTrueLogo size="md" />
          </Link>

          {showNavigation && (
            <>
              {/* Desktop Navigation */}
              <nav
                className="desktop-nav"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                }}
                aria-label="Main navigation"
              >
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
                  Example Rules
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

              {/* Mobile Menu Button */}
              <div
                style={{
                  display: "none",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
                className="mobile-nav-controls"
              >
                {showThemeToggle && <ThemeToggle />}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.375rem",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--fg-default)",
                  }}
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-menu"
                  className="mobile-menu-button"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {showNavigation && mobileMenuOpen && (
        <nav
          id="mobile-menu"
          className="mobile-nav"
          style={{
            position: "fixed",
            top: "73px",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--bg-default)",
            zIndex: 40,
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            borderTop: "1px solid var(--border-color)",
          }}
          aria-label="Mobile navigation"
        >
          <a
            href="/docs"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              textDecoration: "none",
              color: "var(--fg-default)",
              borderRadius: "0.375rem",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Docs
          </a>
          <a
            href="/docs/catalog/available-packs"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              textDecoration: "none",
              color: "var(--fg-default)",
              borderRadius: "0.375rem",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Example Rules
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              textDecoration: "none",
              color: "var(--fg-default)",
              borderRadius: "0.375rem",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            GitHub
          </a>
        </nav>
      )}

      {/* Responsive styles */}
      <style jsx global>{`
        /* Desktop: Show desktop nav, hide mobile controls */
        .desktop-nav {
          display: flex !important;
        }
        .mobile-nav-controls {
          display: none !important;
        }

        /* Mobile: Hide desktop nav, show mobile controls */
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-nav-controls {
            display: flex !important;
          }
        }
      `}</style>
    </>
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
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
