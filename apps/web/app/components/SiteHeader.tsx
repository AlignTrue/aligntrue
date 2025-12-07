"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AlignTrueLogo } from "@aligntrue/ui";
import { Menu, Moon, Sun, X } from "lucide-react";
import { GitHubIcon } from "./GitHubIcon";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleClick = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <button
      onClick={handleClick}
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

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

          <>
            {/* Desktop Navigation */}
            <nav className="desktop-nav" aria-label="Main navigation">
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
                href="/docs/04-reference/features"
                style={{
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: "var(--fg-default)",
                }}
              >
                Features
              </a>
              <a
                href="/docs/about"
                style={{
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: "var(--fg-default)",
                }}
              >
                About
              </a>
              <a
                href="https://github.com/AlignTrue/aligntrue"
                target="_blank"
                rel="noreferrer"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--fg-default)",
                }}
                aria-label="AlignTrue GitHub repository"
              >
                <GitHubIcon size={24} />
              </a>
              <ThemeToggle />
            </nav>

            {/* Mobile Menu Button */}
            <div className="mobile-nav-controls">
              <ThemeToggle />
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
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav
          id="mobile-menu"
          className="mobile-nav"
          style={{
            position: "fixed",
            top: "calc(100px + var(--banner-height, 0px))",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--bg-default)",
            zIndex: 40,
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
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
            href="/docs/04-reference/features"
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
            Features
          </a>
          <a
            href="/docs/about"
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
            About
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <GitHubIcon size={24} />
          </a>
        </nav>
      )}

      {/* Responsive styles */}
      <style>{`
        .desktop-nav {
          display: flex !important;
          align-items: center;
          gap: 1.5rem;
        }

        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
        }

        .mobile-nav-controls {
          display: none;
          align-items: center;
          gap: 0.75rem;
        }

        @media (max-width: 768px) {
          .mobile-nav-controls {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
