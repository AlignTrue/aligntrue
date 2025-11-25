"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AlignTrueLogo } from "@aligntrue/ui";
import {
  Zap,
  RefreshCw,
  Globe,
  FileText,
  Shuffle,
  Users,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { HowItWorksDiagram } from "./components/HowItWorksDiagram";
import { AlphaBanner } from "./components/AlphaBanner";
import { GitHubIcon } from "./components/GitHubIcon";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        marginLeft: "0.5rem",
        padding: "0.5rem 1rem",
        backgroundColor: "transparent",
        border: "1px solid var(--border-color)",
        borderRadius: "0.375rem",
        cursor: "pointer",
        fontSize: "0.875rem",
        color: "var(--text-secondary)",
        fontWeight: "500",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

/**
 * SiteHeader Component (Homepage-specific)
 *
 * Header for AlignTrue homepage with logo, navigation, and theme toggle.
 * Includes mobile-responsive hamburger menu.
 */
function SiteHeader() {
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
              <Link
                href="/docs"
                style={{
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: "var(--fg-default)",
                }}
              >
                Docs
              </Link>
              <Link
                href="/docs/04-reference/features"
                style={{
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: "var(--fg-default)",
                }}
              >
                Features
              </Link>
              <Link
                href="/docs/about"
                style={{
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: "var(--fg-default)",
                }}
              >
                About
              </Link>
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
          <Link
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
          </Link>
          <Link
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
          </Link>
          <Link
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
          </Link>
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
        /* Desktop: Show desktop nav, hide mobile controls */
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

        /* Mobile: Show mobile controls, hide desktop nav */
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

/**
 * SiteFooter Component (Homepage-specific)
 *
 * Simple center-aligned footer for AlignTrue homepage.
 * Displays copyright, licensing info, build & status badges, and tagline.
 */
function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-color)",
        marginTop: "4rem",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          padding: "2rem 1.5rem",
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--fg-muted)",
        }}
      >
        <p>
          © {currentYear} AlignTrue.{" "}
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "underline" }}
          >
            MIT License
          </a>
          .
        </p>
        <p style={{ marginTop: "0.5rem" }}>Made with ❤️ + hash determinism.</p>

        {/* Build & Status Badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginTop: "1.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <a
            href="https://github.com/AlignTrue/aligntrue/actions"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/ci.yml?label=CI&logo=github"
              alt="CI status"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://www.npmjs.com/package/aligntrue"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/npm/v/aligntrue.svg"
              alt="npm version"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://nodejs.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/node-%3E%3D20-brightgreen"
              alt="Node 20+"
              style={{ height: "20px", display: "block" }}
            />
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/license-MIT-blue"
              alt="MIT License"
              style={{ height: "20px", display: "block" }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Homepage CSS - all styles in one block to avoid nested styled-jsx error */}
      <style jsx global>{`
        /* Light mode CSS variables */
        :root {
          --bg-default: #ffffff;
          --bg-muted: #f6f8fa;
          --border-color: #d1d9e0;
          --fg-default: #1f2328;
          --fgColor-default: #1f2328;
          --fg-muted: #59636e;
          --brand-accent: #f5a623;
          --text-secondary: #59636e;
          --bg-secondary: #f6f8fa;
          --font-sans:
            ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif,
            "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol",
            "Noto Color Emoji";
          --font-mono:
            ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
            "Liberation Mono", monospace;
        }

        /* Dark mode CSS variables */
        :root.dark {
          --bg-default: #0d1117;
          --bg-muted: #161b22;
          --border-color: #30363d;
          --fg-default: #f0f6fc;
          --fgColor-default: #f0f6fc;
          --fg-muted: #9198a1;
          --text-secondary: #9198a1;
          --bg-secondary: #161b22;
        }

        /* Base typography */
        body {
          font-family: var(--font-sans);
        }

        code,
        pre {
          font-family: var(--font-mono);
        }

        /* Typography optimization for mobile */
        h1,
        h2,
        h3 {
          text-wrap: balance;
        }

        p {
          text-wrap: pretty;
        }

        .hero-title {
          text-wrap: balance;
          max-width: 20ch;
          margin-left: auto;
          margin-right: auto;
        }

        .hero-description {
          text-wrap: pretty;
          max-width: 65ch;
        }

        /* Component-specific styles */
        .skip-to-content {
          position: absolute;
          top: -40px;
          left: 0;
          background: var(--brand-accent, #f5a623);
          color: white;
          padding: 0.5rem 1rem;
          text-decoration: none;
          z-index: 100;
          border-radius: 0 0 0.25rem 0;
          font-weight: 600;
        }

        .skip-to-content:focus {
          top: 0;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        @media (max-width: 768px) {
          section {
            padding: 3rem 1rem !important;
          }

          .hero-title {
            font-size: 2rem !important;
            line-height: 1.25;
            letter-spacing: -0.02em;
          }

          .hero-description {
            font-size: 1rem !important;
            line-height: 1.65;
          }

          p {
            line-height: 1.65;
          }

          .quickstart-steps {
            grid-template-columns: 1fr !important;
          }

          .command-wrapper {
            flex-wrap: wrap;
            justify-content: center !important;
          }

          .hero-buttons {
            flex-direction: column;
            align-items: stretch;
            max-width: 300px;
            margin-left: auto;
            margin-right: auto;
          }

          .features-grid {
            grid-template-columns: 1fr !important;
          }

          .steps-grid {
            grid-template-columns: 1fr !important;
          }

          .feature-card {
            text-align: center;
          }

          /* Center step headers on mobile */
          .step-card > div:first-child {
            justify-content: center !important;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }

        /* Enhanced focus styles for keyboard navigation */
        a:focus-visible,
        button:focus-visible {
          outline: 2px solid var(--brand-accent, #f5a623);
          outline-offset: 2px;
          border-radius: 0.25rem;
        }

        /* Ensure sufficient color contrast */
        code {
          background-color: var(--bg-muted);
          color: var(--fg-default);
        }
      `}</style>

      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-default)" }}>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <AlphaBanner />
        <SiteHeader />

        <main id="main-content">
          {/* Hero section */}
          <section
            style={{ textAlign: "center", padding: "5rem 1.5rem" }}
            aria-labelledby="hero-heading"
          >
            <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
              <h1
                id="hero-heading"
                className="hero-title"
                style={{
                  fontSize: "clamp(2rem, 5vw, 3rem)",
                  fontWeight: "bold",
                  marginBottom: "1.5rem",
                  lineHeight: "1.2",
                  textWrap: "balance",
                }}
              >
                Sync + manage rules across AI agents, projects & teams.
              </h1>
              <p
                className="hero-description"
                style={{
                  fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
                  color: "var(--fg-muted)",
                  marginBottom: "2rem",
                  maxWidth: "48rem",
                  margin: "0 auto 2rem",
                  lineHeight: "1.6",
                  textWrap: "pretty",
                }}
              >
                Write once, sync everywhere. 20+ agents supported. Extensible.{" "}
                <strong>Start in 60 seconds.</strong>
              </p>
              <div
                className="quickstart-steps"
                style={{
                  maxWidth: "60rem",
                  margin: "0 auto 2rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                  gap: "2rem",
                }}
              >
                {/* Step 1 */}
                <div
                  className="step-card"
                  style={{
                    backgroundColor: "var(--bg-default)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                    padding: "2rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "2rem",
                        height: "2rem",
                        borderRadius: "50%",
                        backgroundColor: "var(--brand-accent, #F5A623)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "1rem",
                        flexShrink: 0,
                      }}
                    >
                      1
                    </div>
                    <h3
                      style={{
                        fontSize: "1.375rem",
                        fontWeight: "600",
                        margin: 0,
                      }}
                    >
                      Install
                    </h3>
                  </div>
                  <div
                    className="command-wrapper"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <code
                      style={{
                        padding: "0.625rem 1rem",
                        backgroundColor: "var(--bg-muted)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.375rem",
                        fontSize: "0.95rem",
                        display: "inline-block",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        fontWeight: "500",
                      }}
                    >
                      npm install -g aligntrue
                    </code>
                    <CopyButton text="npm install -g aligntrue" />
                  </div>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--fg-muted)",
                      margin: 0,
                      lineHeight: "1.5",
                      textAlign: "center",
                      textWrap: "pretty",
                      maxWidth: "32ch",
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    Install to manage agent rules (Cursor <code>.mdc</code>,{" "}
                    <code>AGENTS.md</code>, <code>CLAUDE.md</code>, etc.).
                  </p>
                </div>

                {/* Step 2 */}
                <div
                  className="step-card"
                  style={{
                    backgroundColor: "var(--bg-default)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                    padding: "2rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "2rem",
                        height: "2rem",
                        borderRadius: "50%",
                        backgroundColor: "var(--brand-accent, #F5A623)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "1rem",
                        flexShrink: 0,
                      }}
                    >
                      2
                    </div>
                    <h3
                      style={{
                        fontSize: "1.375rem",
                        fontWeight: "600",
                        margin: 0,
                      }}
                    >
                      Init & Sync
                    </h3>
                  </div>
                  <div
                    className="command-wrapper"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <code
                      style={{
                        padding: "0.625rem 1rem",
                        backgroundColor: "var(--bg-muted)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "0.375rem",
                        fontSize: "0.95rem",
                        display: "inline-block",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        fontWeight: "500",
                      }}
                    >
                      aligntrue init
                    </code>
                    <CopyButton text="aligntrue init" />
                  </div>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--fg-muted)",
                      margin: 0,
                      lineHeight: "1.5",
                      textAlign: "center",
                      textWrap: "pretty",
                      maxWidth: "32ch",
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    <strong>Auto-detects</strong>, <strong>imports</strong> &{" "}
                    <strong>syncs</strong> existing rules, or creates smart
                    defaults if needed.
                  </p>
                </div>
              </div>
              <div
                className="hero-buttons"
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                  marginBottom: "2rem",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/docs/00-getting-started/00-quickstart"
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "var(--brand-accent, #F5A623)",
                    color: "white",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                  aria-label="Get started with AlignTrue quickstart guide"
                >
                  Quickstart Guide
                </Link>
                <Link
                  href="/docs"
                  style={{
                    padding: "0.75rem 1.5rem",
                    border: "1px solid var(--brand-accent, #F5A623)",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    textDecoration: "none",
                    color: "var(--brand-accent, #F5A623)",
                    display: "inline-block",
                  }}
                  aria-label="Read AlignTrue documentation"
                >
                  Read Docs
                </Link>
              </div>
            </div>
          </section>

          {/* How it works section */}
          <section
            style={{
              backgroundColor: "var(--bg-muted)",
              padding: "4rem 1.5rem",
            }}
            aria-labelledby="how-it-works-heading"
          >
            <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
              <h2
                id="how-it-works-heading"
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  textAlign: "center",
                  marginTop: "0.5rem",
                  marginBottom: "1.25rem",
                }}
              >
                How it works
              </h2>

              <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
                <HowItWorksDiagram />
              </div>

              <p
                style={{
                  textAlign: "center",
                  marginTop: "2rem",
                  fontSize: "1rem",
                  color: "var(--fg-muted)",
                  maxWidth: "36rem",
                  margin: "2rem auto 0",
                }}
              >
                Write your rules once in & run <code>aligntrue sync</code>.
                AlignTrue automatically generates agent-specific formats for all
                your AI tools or team members.
              </p>
            </div>
          </section>

          {/* Features section */}
          <section
            style={{
              backgroundColor: "var(--bg-default)",
              borderTop: "1px solid var(--border-color)",
              borderBottom: "1px solid var(--border-color)",
              padding: "4rem 1.5rem",
            }}
            aria-labelledby="features-heading"
          >
            <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
              <h2 id="features-heading" className="sr-only">
                Key Features
              </h2>
              <div
                className="features-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "2rem",
                }}
              >
                <div
                  className="feature-card"
                  style={{
                    backgroundColor: "var(--bg-default)",
                    borderRadius: "0.5rem",
                    padding: "1.5rem",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    className="feature-icon"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    <Zap
                      size={32}
                      stroke="var(--brand-accent, #F5A623)"
                      aria-hidden="true"
                    />
                  </div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      marginBottom: "0.5rem",
                    }}
                  >
                    60-second setup
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--fg-muted)",
                      textWrap: "pretty",
                    }}
                  >
                    Auto-detects your agents & creates starter rules in under a
                    minute. No config required.
                  </p>
                </div>
                <div
                  className="feature-card"
                  style={{
                    backgroundColor: "var(--bg-default)",
                    borderRadius: "0.5rem",
                    padding: "1.5rem",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    className="feature-icon"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    <RefreshCw
                      size={32}
                      stroke="var(--brand-accent, #F5A623)"
                      aria-hidden="true"
                    />
                  </div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Automatic sync
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                    Edit rules once, sync to all agents automatically. No manual
                    copying or outdated rules.
                  </p>
                </div>
                <div
                  className="feature-card"
                  style={{
                    backgroundColor: "var(--bg-default)",
                    borderRadius: "0.5rem",
                    padding: "1.5rem",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    className="feature-icon"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    <Globe
                      size={32}
                      stroke="var(--brand-accent, #F5A623)"
                      aria-hidden="true"
                    />
                  </div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      marginBottom: "0.5rem",
                    }}
                  >
                    20+ agents supported
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--fg-muted)",
                      textWrap: "pretty",
                    }}
                  >
                    Cursor, Codex, Claude Code, Copilot, Claude, Aider,
                    Windsurf, VS Code MCP & 20+ more.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section
            style={{
              maxWidth: "72rem",
              margin: "0 auto",
              padding: "4rem 1.5rem",
            }}
            aria-labelledby="how-it-works-heading"
          >
            <h2
              id="how-it-works-heading"
              style={{
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "3rem",
              }}
            >
              Rule-wrangling, solved.
            </h2>
            <div
              className="steps-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1.5rem",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    margin: "0 auto 1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--brand-accent, #F5A623)",
                  }}
                >
                  <FileText size={24} stroke="white" aria-hidden="true" />
                </div>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  Centralized rule management
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                  Write AI rules once & automatically sync everywhere for
                  everyone.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    margin: "0 auto 1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--brand-accent, #F5A623)",
                  }}
                >
                  <Shuffle size={24} stroke="white" aria-hidden="true" />
                </div>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  Agent adapters
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                  Generates each agent's native formats & keeps existing
                  settings.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    margin: "0 auto 1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--brand-accent, #F5A623)",
                  }}
                >
                  <Users size={24} stroke="white" aria-hidden="true" />
                </div>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  Solo & team modes
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                  Local-first for individuals. PR-friendly for team
                  collaboration.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    margin: "0 auto 1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--brand-accent, #F5A623)",
                  }}
                >
                  <Settings size={24} stroke="white" aria-hidden="true" />
                </div>
                <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  Built-in customizability
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                  Variables, path selectors & overlays for fork-safe upstream
                  updates.
                </p>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
