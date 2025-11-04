"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@aligntrue/ui";
import {
  Zap,
  RefreshCw,
  Globe,
  FileText,
  Shuffle,
  Users,
  Settings,
} from "lucide-react";

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

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-default)" }}>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
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
              }}
            >
              Sync rules across AI agents, projects & teams.
            </h1>
            <p
              className="hero-description"
              style={{
                fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
                color: "var(--fg-muted)",
                marginBottom: "2rem",
                maxWidth: "52rem",
                margin: "0 auto 2rem",
                lineHeight: "1.6",
              }}
            >
              Write once, sync everywhere. 28+ agents supported. Extensible.{" "}
              <strong>Start in 60 seconds.</strong>
            </p>
            <div
              className="quickstart-steps"
              style={{
                maxWidth: "56rem",
                margin: "0 auto 2rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
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
                  padding: "2rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
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
                    Initialize
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
                      fontFamily: "monospace",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                      fontWeight: "500",
                    }}
                  >
                    npx aligntrue init
                  </code>
                  <CopyButton text="npx aligntrue init" />
                </div>
                <p
                  style={{
                    fontSize: "0.95rem",
                    color: "var(--fg-muted)",
                    margin: 0,
                    lineHeight: "1.5",
                    textAlign: "center",
                  }}
                >
                  Auto-detects agents, imports existing rules, or scaffolds{" "}
                  <code>.aligntrue/rules.md</code>.
                </p>
              </div>

              {/* Step 2 */}
              <div
                className="step-card"
                style={{
                  backgroundColor: "var(--bg-default)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
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
                    Sync
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
                      fontFamily: "monospace",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                      fontWeight: "500",
                    }}
                  >
                    aligntrue sync
                  </code>
                  <CopyButton text="aligntrue sync" />
                </div>
                <p
                  style={{
                    fontSize: "0.95rem",
                    color: "var(--fg-muted)",
                    margin: 0,
                    lineHeight: "1.5",
                    textAlign: "center",
                  }}
                >
                  Generates & updates each agent's native files (Cursor,
                  AGENTS.md, VS Code, etc.).
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

        {/* Features section */}
        <section
          style={{
            backgroundColor: "var(--bg-muted)",
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
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
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
                  Two-way sync
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                  Edit rules OR agent files, changes sync both ways. No manual
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
                  28+ agents supported
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                  Cursor, Codex, Claude Code, Copilot, Claude, Aider, Windsurf,
                  VS Code MCP & 20+ more.
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
                One source of truth
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
                Edit: <code>.aligntrue/rules.md</code>
                <br />
                Sync: <code>aligntrue sync</code>
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
                Generates each agent's native files & keeps existing settings.
                Extensible!
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
                Local-first for individuals. PR-friendly for team collaboration.
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

      {/* Responsive styles and accessibility enhancements */}
      <style jsx>{`
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
          }

          .hero-description {
            font-size: 1rem !important;
          }

          .quickstart-steps {
            grid-template-columns: 1fr !important;
          }

          .command-wrapper {
            flex-wrap: wrap;
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
    </div>
  );
}
