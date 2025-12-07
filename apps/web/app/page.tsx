"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BetaBanner } from "./components/BetaBanner";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { getSubmittedUrlFromSearch } from "@/lib/aligns/urlFromSearch";
import type { AlignRecord } from "@/lib/aligns/types";

type AlignSummary = Pick<
  AlignRecord,
  "id" | "title" | "description" | "provider" | "normalizedUrl"
>;

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
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [popular, setPopular] = useState<AlignSummary[]>([]);
  const [recent, setRecent] = useState<AlignSummary[]>([]);

  useEffect(() => {
    const candidate = getSubmittedUrlFromSearch(window.location.search);
    if (candidate) {
      setUrlInput(candidate);
      void handleSubmit(candidate);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setPopular(await fetchList("/api/aligns/popular?limit=8"));
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
    if (!items.length) {
      return <p style={{ color: "#6b7280" }}>Nothing yet.</p>;
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/a/${item.id}`}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "0.75rem",
              textDecoration: "none",
              color: "#111827",
              background: "#fff",
            }}
          >
            <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              {item.provider.toUpperCase()}
            </p>
            <h3 style={{ margin: "0 0 0.25rem 0" }}>
              {item.title || "Untitled align"}
            </h3>
            <p style={{ color: "#4b5563", fontSize: "0.95rem" }}>
              {item.description || "No description provided."}
            </p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-default)" }}>
      <BetaBanner />
      <SiteHeader />

      <main
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "2rem 1.5rem 3rem",
        }}
      >
        <p style={{ color: "var(--fg-muted)", fontWeight: 600 }}>
          AlignTrue Align Catalog
        </p>
        <h1 style={{ margin: "0.25rem 0 0.5rem", color: "var(--fg-default)" }}>
          Paste any public GitHub align URL to get a shareable page.
        </h1>
        <p
          style={{
            color: "var(--fg-muted)",
            marginBottom: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          We normalize GitHub blob/raw links, compute a stable ID, and render a
          detail page at <code>/a/&lt;id&gt;</code>.
        </p>

        <div
          style={{
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            background: "var(--bg-default)",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <label style={{ fontWeight: 600, color: "var(--fg-default)" }}>
            GitHub URL
          </label>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://github.com/org/repo/blob/main/aligns/rules.md"
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              fontSize: "1rem",
              background: "var(--bg-default)",
              color: "var(--fg-default)",
            }}
          />
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              style={{
                padding: "0.75rem 1.25rem",
                borderRadius: "8px",
                border: "none",
                background: "var(--fg-default)",
                color: "white",
                cursor: "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Get shareable align"}
            </button>
          </div>
        </div>

        <section style={{ marginTop: "2.5rem" }}>
          <h2 style={{ marginBottom: "0.5rem", color: "var(--fg-default)" }}>
            Most popular aligns
          </h2>
          {renderCards(popular)}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ marginBottom: "0.5rem", color: "var(--fg-default)" }}>
            Recently submitted aligns
          </h2>
          {renderCards(recent)}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
