"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@aligntrue/ui";

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
        padding: "0.25rem 0.5rem",
        backgroundColor: "transparent",
        border: "1px solid var(--border-color)",
        borderRadius: "0.25rem",
        cursor: "pointer",
        fontSize: "0.75rem",
        color: "var(--text-secondary)",
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
      <SiteHeader />

      {/* Hero section */}
      <section style={{ textAlign: "center", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "3rem",
              fontWeight: "bold",
              marginBottom: "1.5rem",
            }}
          >
            Sync rules across AI agents, projects & teams.
          </h1>
          <p
            style={{
              fontSize: "1.25rem",
              color: "var(--fg-muted)",
              marginBottom: "2rem",
              maxWidth: "52rem",
              margin: "0 auto 2rem",
            }}
          >
            Write once, sync everywhere. 28+ agents supported. Extensible.{" "}
            <strong>Start in 60 seconds.</strong>
          </p>
          <code
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--bg-muted)",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
            }}
          >
            npx aligntrue init
          </code>
          <CopyButton text="npx aligntrue init" />
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              marginBottom: "2rem",
              marginTop: "2rem",
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
              }}
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
              }}
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
      >
        <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "2rem",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--bg-default)",
                borderRadius: "0.5rem",
                padding: "1.5rem",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                ⚡
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
              style={{
                backgroundColor: "var(--bg-default)",
                borderRadius: "0.5rem",
                padding: "1.5rem",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                🔄
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
              style={{
                backgroundColor: "var(--bg-default)",
                borderRadius: "0.5rem",
                padding: "1.5rem",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>
                🌐
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
                Cursor, Codex, Claude Code, Copilot, Claude, Aider, Windsurf, VS
                Code MCP & 20+ more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        style={{ maxWidth: "72rem", margin: "0 auto", padding: "4rem 1.5rem" }}
      >
        <h2
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "3rem",
          }}
        >
          How it works
        </h2>
        <div
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
                fontSize: "1.25rem",
                fontWeight: "bold",
                backgroundColor: "var(--brand-accent, #F5A623)",
                color: "white",
              }}
            >
              1
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              One source of truth
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              <strong>Update:</strong> <code>.aligntrue/rules.md</code>
              <br />
              <strong>Sync:</strong> <code>aligntrue sync</code>
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
                fontSize: "1.25rem",
                fontWeight: "bold",
                backgroundColor: "var(--brand-accent, #F5A623)",
                color: "white",
              }}
            >
              2
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Sync to all agents
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              One command: <code>aligntrue sync</code>
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
                fontSize: "1.25rem",
                fontWeight: "bold",
                backgroundColor: "var(--brand-accent, #F5A623)",
                color: "white",
              }}
            >
              3
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Solo & team modes
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              <strong>Solo:</strong> Fast, simple, local-first
              <br />
              <strong>Team:</strong> Collaboration & governance
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
                fontSize: "1.25rem",
                fontWeight: "bold",
                backgroundColor: "var(--brand-accent, #F5A623)",
                color: "white",
              }}
            >
              4
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Agent formats & configs
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              Adapts for every agent, preserves settings
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
