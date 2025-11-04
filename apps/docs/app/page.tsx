"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-default)" }}>
      {/* Simple header */}
      <header
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
            <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
              AlignTrue
            </span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
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
              href="/docs/catalog/available-packs"
              style={{
                fontSize: "0.875rem",
                textDecoration: "none",
                color: "var(--fg-default)",
              }}
            >
              Catalog
            </Link>
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
            {mounted && (
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
            )}
          </nav>
        </div>
      </header>

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
            Write once, sync everywhere
          </h1>
          <p
            style={{
              fontSize: "1.25rem",
              color: "var(--fg-muted)",
              marginBottom: "2rem",
              maxWidth: "48rem",
              margin: "0 auto 2rem",
            }}
          >
            One markdown file generates agent-specific formats for 28+ AI coding
            tools. Keep your personal AI rules consistent across projects and
            machines.
          </p>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              marginBottom: "2rem",
            }}
          >
            <Link
              href="/docs/getting-started/quickstart"
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "var(--primary-color)",
                color: "white",
                borderRadius: "0.5rem",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Get Started
            </Link>
            <Link
              href="/docs"
              style={{
                padding: "0.75rem 1.5rem",
                border: "1px solid var(--border-color)",
                borderRadius: "0.5rem",
                fontWeight: "600",
                textDecoration: "none",
                color: "var(--fg-default)",
              }}
            >
              Read Docs
            </Link>
          </div>
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
                Auto-detects your agents and creates starter rules in under a
                minute. No configuration required.
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
                Edit rules OR agent files - changes flow both directions
                automatically. Stay aligned without manual copying.
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
                Cursor, GitHub Copilot, Claude, Aider, Windsurf, VS Code MCP,
                and 22+ more through 43 specialized exporters.
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
                backgroundColor: "var(--primary-color)",
                color: "white",
              }}
            >
              1
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Write rules
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              In <code>.aligntrue/rules.md</code> using simple markdown
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
                backgroundColor: "var(--primary-color)",
                color: "white",
              }}
            >
              2
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Run sync
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              AlignTrue detects installed agents automatically
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
                backgroundColor: "var(--primary-color)",
                color: "white",
              }}
            >
              3
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Agent exports
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              Each agent gets its native format (.mdc, .json, .yml)
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
                backgroundColor: "var(--primary-color)",
                color: "white",
              }}
            >
              4
            </div>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Stay aligned
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
              Edit markdown or agent files - sync keeps everything consistent
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
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
          <p>© {new Date().getFullYear()} AlignTrue. MIT License.</p>
          <p style={{ marginTop: "0.5rem" }}>
            Made with ❤️ and hash determinism.
          </p>
        </div>
      </footer>
    </div>
  );
}
