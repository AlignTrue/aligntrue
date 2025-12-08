"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Globe,
  RefreshCw,
  Settings,
  Shuffle,
  Users,
  Zap,
} from "lucide-react";
import { BetaBanner } from "./components/BetaBanner";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { HowItWorksDiagram } from "./components/HowItWorksDiagram";
import { getSubmittedUrlFromSearch } from "@/lib/aligns/urlFromSearch";
import type { AlignRecord } from "@/lib/aligns/types";

type AlignSummary = Pick<
  AlignRecord,
  "id" | "title" | "description" | "provider" | "normalizedUrl"
>;

function ownerFromUrl(url: string | undefined): string {
  if (!url) return "Unknown";
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] ? `@${parts[0]}` : "Unknown";
  } catch {
    return "Unknown";
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        padding: "0.5rem 1rem",
        backgroundColor: "transparent",
        border: "1px solid var(--border-color)",
        borderRadius: "0.375rem",
        cursor: "pointer",
        fontSize: "0.875rem",
        color: "var(--text-secondary)",
        fontWeight: 500,
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

async function submitUrl(url: string): Promise<string> {
  const response = await fetch("/api/aligns/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to submit URL");
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

async function fetchList(path: string): Promise<AlignSummary[]> {
  const response = await fetch(path);
  if (!response.ok) return [];
  return (await response.json()) as AlignSummary[];
}

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"rules" | "scratch">("rules");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<AlignSummary[]>([]);

  useEffect(() => {
    const candidate = getSubmittedUrlFromSearch(window.location.search);
    if (candidate) {
      setUrlInput(candidate);
      setActiveTab("rules");
      void handleSubmit(candidate);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setRecent(await fetchList("/api/aligns/recent?limit=8"));
    })();
  }, []);

  const handleSubmit = async (value?: string) => {
    const target = value ?? urlInput;
    if (!target) {
      setError("Enter a GitHub URL to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const id = await submitUrl(target);
      router.push(`/a/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCards = (items: AlignSummary[]) => {
    const limited = items.slice(0, 6);
    if (!limited.length) {
      return <p style={{ color: "var(--fg-muted)" }}>Nothing yet.</p>;
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {limited.map((item) => {
          const owner = ownerFromUrl(item.normalizedUrl);
          return (
            <Link
              key={item.id}
              href={`/a/${item.id}`}
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "0.75rem",
                textDecoration: "none",
                color: "var(--fg-default)",
                background: "var(--bg-default)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <p style={{ fontSize: "0.9rem", color: "var(--fg-muted)" }}>
                {owner}
              </p>
              <h3 style={{ margin: "0 0 0.25rem 0" }}>
                {item.title || "Untitled align"}
              </h3>
            </Link>
          );
        })}
      </div>
    );
  };

  const TabButton = ({
    id,
    label,
  }: {
    id: "rules" | "scratch";
    label: string;
  }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          padding: "0.75rem 1rem",
          border: "1px solid var(--border-color)",
          borderBottom: isActive
            ? "2px solid var(--fg-default)"
            : "1px solid var(--border-color)",
          borderRadius: "0.5rem 0.5rem 0 0",
          backgroundColor: isActive ? "var(--bg-default)" : "var(--bg-muted)",
          color: "var(--fg-default)",
          fontWeight: 600,
          cursor: "pointer",
        }}
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  };

  const renderRulesTab = () => (
    <div
      style={{
        maxWidth: "52rem",
        margin: "0 auto",
        border: "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        background: "var(--bg-default)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <label style={{ fontWeight: 600, color: "var(--fg-default)" }}>
          Enter a GitHub URL with AI rules (.mdc, .md, etc.)
        </label>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "stretch",
            flexWrap: "wrap",
          }}
        >
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a GitHub URL, supports blob and raw URLs."
            style={{
              padding: "1rem",
              borderRadius: "10px",
              border: "2px solid var(--border-color)",
              fontSize: "1.1rem",
              background: "var(--bg-default)",
              color: "var(--fg-default)",
              flex: "1 1 360px",
              minWidth: "0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            style={{
              padding: "0.95rem 1.4rem",
              borderRadius: "10px",
              border: "none",
              background: "var(--brand-accent, #F5A623)",
              color: "white",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              minWidth: "140px",
            }}
          >
            {submitting ? "Generating..." : "Generate Align"}
          </button>
        </div>
        {error && (
          <p style={{ color: "#b91c1c", margin: 0, fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.5rem", color: "var(--fg-default)" }}>
          Recent Aligns
        </h3>
        {renderCards(recent)}
      </section>
    </div>
  );

  const renderScratchTab = () => (
    <div
      style={{
        maxWidth: "52rem",
        margin: "0 auto",
        backgroundColor: "var(--bg-default)",
        border: "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {[
          {
            step: "1",
            title: "Install",
            command: "npm install -g aligntrue",
            text: (
              <>
                Install to manage agent rules (Cursor <code>.mdc</code>,{" "}
                <code>AGENTS.md</code>, <code>CLAUDE.md</code>, etc.).
              </>
            ),
          },
          {
            step: "2",
            title: "Init & Sync",
            command: "aligntrue init",
            text: (
              <>
                Auto-detects, imports, and syncs existing rules or creates smart
                defaults if needed.
              </>
            ),
          },
        ].map((card) => (
          <div
            key={card.step}
            style={{
              backgroundColor: "var(--bg-default)",
              border: "1px solid var(--border-color)",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              padding: "1.5rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                marginBottom: "1rem",
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
                  fontWeight: 700,
                  fontSize: "1rem",
                  flexShrink: 0,
                }}
              >
                {card.step}
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                {card.title}
              </h3>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
                flexWrap: "wrap",
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
                  fontWeight: 500,
                }}
              >
                {card.command}
              </code>
              <CopyButton text={card.command} />
            </div>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--fg-muted)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {card.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-default)" }}>
      <style jsx global>{`
        .hero-title {
          text-wrap: balance;
          max-width: 48ch;
          margin-left: auto;
          margin-right: auto;
          text-wrap: pretty;
        }
        .hero-description {
          text-wrap: pretty;
          max-width: 65ch;
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
        }
      `}</style>

      <a href="#main-content" className="sr-only">
        Skip to main content
      </a>
      <BetaBanner />
      <SiteHeader />

      <main id="main-content">
        <section
          style={{ textAlign: "center", padding: "4rem 1.5rem 3rem" }}
          aria-labelledby="hero-heading"
        >
          <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
            <h1
              id="hero-heading"
              className="hero-title"
              style={{
                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                fontWeight: "bold",
                marginBottom: "2rem",
                lineHeight: "1.2",
                color: "var(--fg-default)",
                textWrap: "balance",
              }}
            >
              Sync + manage rules across AI agents, projects & teams.
            </h1>
            <p
              className="hero-description"
              style={{
                fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
                color: "var(--fg-muted)",
                marginBottom: "2.5rem",
                maxWidth: "48rem",
                marginInline: "auto",
                lineHeight: 1.6,
              }}
            >
              Write once, sync everywhere. 20+ agents supported. Extensible.{" "}
              <strong>Start in 60 seconds.</strong>
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                marginBottom: "0",
                flexWrap: "wrap",
              }}
            >
              <TabButton id="rules" label="Start with rules" />
              <TabButton id="scratch" label="Start from scratch" />
            </div>

            <div style={{ marginTop: "-1px" }}>
              {activeTab === "rules" ? renderRulesTab() : renderScratchTab()}
            </div>

            <div
              className="hero-buttons"
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "center",
                marginTop: "2.5rem",
                flexWrap: "wrap",
              }}
            >
              <a
                href="/docs/00-getting-started/00-quickstart"
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "var(--brand-accent, #F5A623)",
                  color: "white",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Quickstart Guide
              </a>
              <a
                href="/docs"
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "1px solid var(--brand-accent, #F5A623)",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: "var(--brand-accent, #F5A623)",
                  display: "inline-block",
                }}
              >
                Read Docs
              </a>
            </div>
          </div>
        </section>

        <section
          style={{
            backgroundColor: "var(--bg-muted)",
            padding: "4rem 1.5rem",
            borderTop: "1px solid var(--border-color)",
            borderBottom: "1px solid var(--border-color)",
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
                color: "var(--fg-default)",
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
                marginTop: "1.5rem",
                fontSize: "1rem",
                color: "var(--fg-muted)",
                maxWidth: "36rem",
                marginInline: "auto",
              }}
            >
              Write your rules once & run <code>aligntrue sync</code>. AlignTrue
              automatically generates agent-specific formats for all your AI
              tools or team members.
            </p>
          </div>
        </section>

        <section
          style={{
            backgroundColor: "var(--bg-default)",
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
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "var(--fg-default)",
                  }}
                >
                  60-second setup
                </h3>
                <p
                  style={{
                    fontSize: "0.9rem",
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
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "var(--fg-default)",
                  }}
                >
                  Automatic sync
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--fg-muted)" }}>
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
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "var(--fg-default)",
                  }}
                >
                  20+ agents supported
                </h3>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--fg-muted)",
                    textWrap: "pretty",
                  }}
                >
                  Cursor, Codex, Claude Code, Copilot, Claude, Aider, Windsurf,
                  VS Code MCP & more.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            maxWidth: "72rem",
            margin: "0 auto",
            padding: "4rem 1.5rem",
          }}
          aria-labelledby="rule-wrangling-heading"
        >
          <h2
            id="rule-wrangling-heading"
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "3rem",
              color: "var(--fg-default)",
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
              <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                Centralized rule management
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--fg-muted)" }}>
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
              <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                Agent exporters
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--fg-muted)" }}>
                Generates each agent's native formats & keeps existing settings.
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
              <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                Solo & team modes
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--fg-muted)" }}>
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
              <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                Built-in customizability
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--fg-muted)" }}>
                Variables, path selectors & overlays for fork-safe upstream
                updates.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
