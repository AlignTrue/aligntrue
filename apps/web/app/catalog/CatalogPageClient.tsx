"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { AlignCard, type AlignSummary } from "@/app/components/AlignCard";
import { AlignDetailPreview } from "@/components/AlignDetailPreview";
import { GitHubIcon } from "@/app/components/GitHubIcon";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CommandBlock } from "@/components/CommandBlock";
import { SectionBadge } from "@/app/components/SectionBadge";
import type { AlignRecord } from "@/lib/aligns/types";
import type { CachedContent } from "@/lib/aligns/content-cache";

type SortBy = "recent" | "popular";
type KindFilter = "all" | "rule" | "pack";

type DetailPayload = { align: AlignRecord; content: CachedContent | null };

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function submitUrl(url: string): Promise<{ id: string }> {
  const response = await fetch("/api/aligns/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error ?? "Failed to submit URL", {
      cause: { hint: data.hint, issueUrl: data.issueUrl },
    });
    throw error;
  }
  return (await response.json()) as { id: string };
}

export function CatalogPageClient() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorIssueUrl, setErrorIssueUrl] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [pageSize, setPageSize] = useState(9);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AlignSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [preview, setPreview] = useState<DetailPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeAlignId, setActiveAlignId] = useState<string | null>(null);
  const detailCache = useRef<Map<string, DetailPayload>>(new Map());
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [showImportHelp, setShowImportHelp] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          sort: sortBy,
          limit: String(pageSize),
          offset: String(page * pageSize),
        });
        if (debouncedSearch) params.set("query", debouncedSearch);
        if (kind !== "all") params.set("kind", kind);

        const res = await fetch(`/api/aligns/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as {
          items: AlignSummary[];
          total: number;
        };
        if (!controller.signal.aborted) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (err) {
        if (!controller.signal.aborted && !isAbortError(err)) {
          console.error("Search failed", err);
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [debouncedSearch, kind, sortBy, page, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, total, pageSize]);

  const clearPreview = useCallback(() => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    setPreview(null);
    setPreviewError(null);
    setActiveAlignId(null);
  }, []);

  useEffect(() => {
    clearPreview();
  }, [page, clearPreview]);

  const handleImport = async () => {
    if (!urlInput) {
      setError("Enter a GitHub URL to continue.");
      setErrorHint(null);
      setErrorIssueUrl(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setErrorHint(null);
    setErrorIssueUrl(null);
    try {
      const { id } = await submitUrl(urlInput);
      router.push(`/a/${id}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        const cause = err.cause as { hint?: string; issueUrl?: string } | null;
        setErrorHint(cause?.hint ?? null);
        setErrorIssueUrl(cause?.issueUrl ?? null);
      } else {
        setError("Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const loadPreview = useCallback(async (align: AlignSummary) => {
    setPreviewError(null);
    setActiveAlignId(align.id);
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    if (detailCache.current.has(align.id)) {
      setPreview(detailCache.current.get(align.id) ?? null);
      return;
    }

    // Cancel any in-flight preview request before starting a new one.
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/aligns/${align.id}/detail`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load align");
      const data = (await res.json()) as DetailPayload;
      if (!controller.signal.aborted) {
        detailCache.current.set(align.id, data);
        setPreview(data);
      }
    } catch (err) {
      if (!controller.signal.aborted && !isAbortError(err)) {
        console.error("Preview load failed", err);
        setPreview(null);
        setPreviewError("Unable to load preview. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setPreviewLoading(false);
      }
    }
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const startIndex = total === 0 ? 0 : page * pageSize + 1;
  const endIndex = Math.min(total, (page + 1) * pageSize);

  return (
    <PageLayout>
      <section
        className="relative text-center px-4 py-14 md:py-18 hero-surface hero-background"
        aria-labelledby="catalog-hero-heading"
      >
        <div className="grid-pattern" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto space-y-8">
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mx-auto rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          >
            <GitHubIcon size={14} />
            <span>AlignTrue CLI</span>
            <span className="text-border">|</span>
            <span>Open Source</span>
            <span className="text-border">|</span>
            <span>MIT License</span>
          </a>
          <div className="space-y-3">
            <h1
              id="catalog-hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight text-foreground max-w-5xl mx-auto text-balance"
            >
              Import rules from GitHub for easy sharing
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-4xl mx-auto text-pretty">
              Paste a GitHub URL to import rules & Aligns to easily share with
              others.
            </p>
          </div>

          <Card className="max-w-4xl mx-auto text-left" variant="surface">
            <CardContent className="p-6 md:p-7 space-y-6">
              <div className="space-y-3">
                <label
                  className="font-semibold text-foreground"
                  htmlFor="align-url"
                >
                  Import from GitHub (.mdc, .md, Align packs)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    id="align-url"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://github.com/user/repo/blob/main/rules/..."
                    className="h-12 text-base flex-1 bg-muted"
                  />
                  <Button
                    onClick={() => void handleImport()}
                    disabled={submitting}
                    className="h-12 px-5 font-semibold"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" />
                        Importing...
                      </span>
                    ) : (
                      "Import"
                    )}
                  </Button>
                </div>
                {error && (
                  <div className="text-sm space-y-1" aria-live="polite">
                    <p className="font-semibold text-destructive m-0">
                      {error}
                    </p>
                    {errorHint && (
                      <p className="text-muted-foreground m-0">{errorHint}</p>
                    )}
                    {errorIssueUrl && (
                      <a
                        href={errorIssueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary font-semibold hover:underline"
                      >
                        Have a file type we should support? Create an issue
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  onClick={() => setShowImportHelp((v) => !v)}
                  aria-expanded={showImportHelp}
                  aria-controls="import-help"
                >
                  <span>How imports work</span>
                  {showImportHelp ? (
                    <ChevronUp size={18} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={18} className="text-muted-foreground" />
                  )}
                </button>
                {showImportHelp && (
                  <div
                    id="import-help"
                    className="space-y-3 text-sm text-muted-foreground"
                  >
                    <ol className="list-decimal list-inside space-y-2">
                      <li>
                        AlignTrue fetches your rules and normalizes them into
                        IR.
                      </li>
                      <li>
                        Rules are written to <code>.aligntrue/rules</code> as
                        the single source of truth.
                      </li>
                      <li>
                        Agent exports are generated on sync (
                        <code>aligntrue sync</code>) in native formats (Cursor
                        .mdc, AGENTS.md, etc.).
                      </li>
                    </ol>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold"
                      >
                        <a
                          href="/docs/00-getting-started/00-quickstart"
                          className="hover:underline"
                        >
                          Quickstart guide
                        </a>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold"
                      >
                        <a
                          href="/docs/03-concepts/sync-behavior"
                          className="hover:underline"
                        >
                          How sync works
                        </a>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold"
                      >
                        <a
                          href="/docs/04-reference/agent-support"
                          className="hover:underline"
                        >
                          Agent compatibility
                        </a>
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        id="catalog"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8"
        aria-labelledby="catalog-list-heading"
      >
        <div className="flex flex-col gap-6">
          <div className="space-y-3 text-center">
            <SectionBadge>Discover Better Rules</SectionBadge>
            <h2
              id="catalog-list-heading"
              className="text-3xl md:text-4xl font-bold text-foreground"
            >
              Browse the rule catalog
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto text-pretty">
              Search user-submitted rules & Align packs. Use Preview to inspect
              details or Open to jump into the Align.
            </p>
          </div>

          <Card variant="surface">
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative w-full max-w-lg">
                    <Input
                      placeholder="Search by title or description"
                      value={search}
                      onChange={(e) => {
                        setPage(0);
                        setSearch(e.target.value);
                      }}
                      className="pl-9"
                    />
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={kind}
                    onValueChange={(v) => {
                      setPage(0);
                      setKind(v as KindFilter);
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Kind" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All kinds</SelectItem>
                      <SelectItem value="rule">Rules</SelectItem>
                      <SelectItem value="pack">Packs</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={sortBy}
                    onValueChange={(v) => {
                      setPage(0);
                      setSortBy(v as SortBy);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Newest</SelectItem>
                      <SelectItem value="popular">Most installs</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPage(0);
                      setPageSize(Number(v));
                    }}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9">9</SelectItem>
                      <SelectItem value="18">18</SelectItem>
                      <SelectItem value="36">36</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground flex-wrap">
                  <p className="m-0">
                    {total === 0
                      ? "No Aligns found"
                      : `Showing ${startIndex}-${endIndex} of ${total}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading
                  ? Array.from({ length: pageSize }).map((_, idx) => (
                      <SkeletonCard key={`skeleton-${idx}`} />
                    ))
                  : items.map((align) => (
                      <AlignCard
                        key={align.id}
                        align={align}
                        isSelected={activeAlignId === align.id}
                        onSelect={() => void loadPreview(align)}
                      />
                    ))}
              </div>

              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page + 1 >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(preview || previewLoading || previewError) && (
            <Card ref={previewRef} variant="surface" className="scroll-mt-24">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-xl">Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (preview?.align.id)
                        router.push(`/a/${preview.align.id}`);
                    }}
                    disabled={!preview}
                  >
                    Open Page
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearPreview}
                    aria-label="Close preview"
                  >
                    <X />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewLoading && (
                  <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="animate-spin" />
                    Loading preview...
                  </div>
                )}
                {previewError && (
                  <p className="text-sm text-destructive m-0">{previewError}</p>
                )}
                {preview && (
                  <AlignDetailPreview
                    align={preview.align}
                    content={preview.content}
                    className="space-y-4"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {!preview && !previewLoading && !previewError && (
          <Card variant="surface">
            <CardHeader>
              <CardTitle className="text-xl">Quick start commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CommandBlock code="npm install -g aligntrue" copyLabel="Copy" />
              <CommandBlock
                code="aligntrue init"
                copyLabel="Copy"
                description="Init (auto-runs sync to generate agent files)"
              />
            </CardContent>
          </Card>
        )}
      </section>
    </PageLayout>
  );
}
