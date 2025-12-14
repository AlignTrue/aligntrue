"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Settings,
  Shuffle,
  Users,
  Zap,
} from "lucide-react";
import { SectionBadge } from "./components/SectionBadge";
import { HowItWorksDiagram } from "./components/HowItWorksDiagram";
import { GitHubIcon } from "./components/GitHubIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { getSubmittedUrlFromSearch } from "@/lib/aligns/urlFromSearch";
import { CommandBlock } from "@/components/CommandBlock";
import { PageLayout } from "@/components/PageLayout";
import { SkeletonCard } from "@/components/SkeletonCard";
import { AlignCard, type AlignSummary } from "./components/AlignCard";
import { useVisibilityRecovery } from "@/lib/useVisibilityRecovery";

type SubmitResult = { id: string };

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function submitUrl(url: string): Promise<SubmitResult> {
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
  const data = (await response.json()) as SubmitResult;
  return data;
}

async function fetchList(
  path: string,
  init?: RequestInit,
): Promise<AlignSummary[]> {
  const response = await fetch(path, init);
  if (!response.ok) return [];
  return (await response.json()) as AlignSummary[];
}

export function HomePageClient() {
  const router = useRouter();
  const recentAbortRef = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "cli">("cli");
  const tabsBaseId = useId();
  const cliTriggerId = `${tabsBaseId}-trigger-cli`;
  const cliContentId = `${tabsBaseId}-content-cli`;
  const rulesTriggerId = `${tabsBaseId}-trigger-rules`;
  const rulesContentId = `${tabsBaseId}-content-rules`;
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorIssueUrl, setErrorIssueUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<AlignSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [showImportHelp, setShowImportHelp] = useState(false);

  useEffect(() => {
    const candidate = getSubmittedUrlFromSearch(window.location.search);
    if (!candidate) return;
    setUrlInput(candidate);
    setActiveTab("rules");
    void (async () => {
      setSubmitting(true);
      setError(null);
      setErrorHint(null);
      setErrorIssueUrl(null);
      try {
        const { id } = await submitUrl(candidate);
        router.push(`/a/${id}`);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
          const cause = err.cause as {
            hint?: string;
            issueUrl?: string;
          } | null;
          setErrorHint(cause?.hint ?? null);
          setErrorIssueUrl(cause?.issueUrl ?? null);
        } else {
          setError("Submission failed");
        }
      } finally {
        setSubmitting(false);
      }
    })();
  }, [router]);

  const loadRecentAligns = useCallback(async (signal?: AbortSignal) => {
    const controller = signal ? null : new AbortController();
    const activeSignal = signal ?? controller!.signal;

    if (controller) {
      // Cancel any in-flight request before starting a new one.
      if (recentAbortRef.current) {
        recentAbortRef.current.abort();
      }
      recentAbortRef.current = controller;
    }

    setRecentLoading(true);
    try {
      const result = await fetchList("/api/aligns/recent?limit=8", {
        signal: activeSignal,
      });
      if (!activeSignal.aborted) {
        setRecent(result);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error("Failed to load recent aligns", err);
      }
    } finally {
      if (!activeSignal.aborted) {
        setRecentLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadRecentAligns(controller.signal);
    return () => controller.abort();
  }, [loadRecentAligns]);

  useVisibilityRecovery(() => {
    void loadRecentAligns();
  });

  useEffect(() => {
    return () => {
      if (recentAbortRef.current) {
        recentAbortRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (value?: string) => {
    const target = value ?? urlInput;
    if (!target) {
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
      const { id } = await submitUrl(target);
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

  const renderCards = (items: AlignSummary[]) => {
    const limited = items.slice(0, 6);
    if (!limited.length) return null;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-1">
        {limited.map((item) => (
          <AlignCard key={item.id} align={item} />
        ))}
      </div>
    );
  };

  const renderSkeletonCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, idx) => (
        <SkeletonCard key={`skeleton-${idx}`} />
      ))}
    </div>
  );

  const renderImportCard = () => (
    <Card className="max-w-4xl mx-auto text-left" variant="surface">
      <CardContent className="p-6 md:p-7 space-y-6">
        <div className="space-y-3">
          <label className="font-semibold text-foreground" htmlFor="align-url">
            Import AI rules (.mdc, .md, Align packs, etc.) directly from GitHub.
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
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="h-12 px-5 font-semibold"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" />
                  Generating...
                </span>
              ) : (
                "Import"
              )}
            </Button>
          </div>
          {error && (
            <div className="text-sm space-y-1" aria-live="polite">
              <p className="font-semibold text-destructive m-0">{error}</p>
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
                  AlignTrue fetches your rules and normalizes them into IR.
                </li>
                <li>
                  Rules are written to <code>.aligntrue/rules</code> as the
                  single source of truth.
                </li>
                <li>
                  Agent exports are generated on sync (
                  <code>aligntrue sync</code>) in native formats (Cursor .mdc,
                  AGENTS.md, etc.).
                </li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs font-semibold">
                  <a
                    href="/docs/00-getting-started/00-quickstart"
                    className="hover:underline"
                  >
                    Quickstart guide
                  </a>
                </Badge>
                <Badge variant="outline" className="text-xs font-semibold">
                  <a
                    href="/docs/03-concepts/sync-behavior"
                    className="hover:underline"
                  >
                    How sync works
                  </a>
                </Badge>
                <Badge variant="outline" className="text-xs font-semibold">
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

        <div>
          <Link
            href="/import"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Importing multiple? Try bulk import →
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  const renderCLITab = () => (
    <div className="grid gap-4 sm:grid-cols-2 max-w-5xl mx-auto">
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
              Auto-detects existing rules, imports them, and syncs or creates
              smart defaults.
            </>
          ),
        },
      ].map((card) => (
        <Card key={card.step} className="h-full" variant="surface">
          <CardHeader className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                {card.step}
              </div>
              <CardTitle className="text-lg">{card.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <CommandBlock code={card.command} copyLabel="Copy" showPrompt />
            <p className="text-sm text-muted-foreground leading-6 text-balance">
              {card.text}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <PageLayout>
      <section
        id="page-top"
        className="relative text-center px-4 py-14 md:py-20 hero-surface hero-background"
        aria-labelledby="hero-heading"
      >
        <div className="grid-pattern" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto space-y-8">
          <a
            href="https://github.com/AlignTrue/aligntrue/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mx-auto rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground fade-in-up"
            data-delay="0"
          >
            <GitHubIcon size={14} />
            <span>AlignTrue CLI</span>
            <span className="text-border">|</span>
            <span>Open Source</span>
            <span className="text-border">|</span>
            <span>MIT License</span>
          </a>
          <h1
            id="hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground max-w-5xl mx-auto text-balance fade-in-up"
            data-delay="1"
          >
            Sync AI rules across agents, repos & teams.
          </h1>
          <p
            className="text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-4xl mx-auto text-pretty fade-in-up"
            data-delay="2"
          >
            Write once, sync everywhere. Works with 20+ agents. Extensible.{" "}
            <strong>Start in 60 seconds.</strong>
          </p>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "rules" | "cli")}
            className="w-full fade-in-up"
            data-delay="3"
          >
            <TabsList className="w-full max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-1 rounded-xl bg-muted/70 border border-border p-1.5 shadow-sm">
              <TabsTrigger
                id={cliTriggerId}
                aria-controls={cliContentId}
                value="cli"
                className="text-base px-4 py-2"
              >
                Install CLI
              </TabsTrigger>
              <TabsTrigger
                id={rulesTriggerId}
                aria-controls={rulesContentId}
                value="rules"
                className="text-base px-4 py-2"
              >
                Import Rules
              </TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent
                id={cliContentId}
                aria-labelledby={cliTriggerId}
                value="cli"
              >
                {renderCLITab()}
              </TabsContent>
              <TabsContent
                id={rulesContentId}
                aria-labelledby={rulesTriggerId}
                value="rules"
              >
                {renderImportCard()}
              </TabsContent>
            </div>
          </Tabs>

          <div
            className="flex flex-wrap justify-center gap-3 fade-in-up"
            data-delay="5"
          >
            <Button asChild className="px-5 py-2.5">
              <Link
                href={
                  "/docs/00-getting-started/00-quickstart" as unknown as Route
                }
              >
                Quickstart Guide
              </Link>
            </Button>
            <Button asChild variant="outline" className="px-5 py-2.5">
              <Link href={"/docs" as unknown as Route}>Read Docs</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        className="bg-muted border-y border-border px-4 sm:px-6 py-16"
        aria-labelledby="how-it-works-heading"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2
              id="how-it-works-heading"
              className="text-3xl md:text-4xl font-bold text-foreground"
            >
              Write once. Sync everywhere.
            </h2>
            <div className="max-w-4xl mx-auto">
              <HowItWorksDiagram />
            </div>
            <p className="text-center text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-7 text-balance">
              Run <code>aligntrue sync</code> to generate native agent files.
              Keep one source of truth, ship rule updates instantly to Cursor,
              Claude Code, Copilot, Codex, Windsurf & more.
            </p>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent dark:via-white/15" />

          <div className="grid gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto place-items-center">
            {[
              {
                icon: Zap,
                title: "60-second setup",
                text: "Auto-detect agents, import existing rules, and sync in under a minute.",
              },
              {
                icon: RefreshCw,
                title: "Automatic sync",
                text: "Edit once, sync to every agent—no manual copying or drift.",
              },
              {
                icon: Globe,
                title: "20+ agent formats",
                text: "Cursor .mdc, AGENTS.md, Claude Code, VS Code MCP, Windsurf, Copilot, and more.",
              },
            ].map((feature) => (
              <Card
                key={feature.title}
                className="h-full border-[var(--card-border-subtle)] bg-card/90"
                variant="feature"
              >
                <CardContent className="p-6 space-y-3 text-center">
                  <feature.icon
                    size={32}
                    className="text-primary transition-transform duration-200 mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-6 text-pretty">
                    {feature.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
        aria-hidden="true"
      />

      <section
        className="px-4 sm:px-6 py-16"
        aria-labelledby="rule-wrangling-heading"
      >
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <SectionBadge>Simplify AI workflows</SectionBadge>
            <h2
              id="rule-wrangling-heading"
              className="text-3xl md:text-4xl font-bold text-foreground"
            >
              Rule-wrangling, solved.
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto leading-7 text-balance">
              One source of truth for rules and outputs; sync safely across
              agents and teams with built-in customization.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: FileText,
                title: "Central rule management",
                text: "Write AI rules once & automatically sync everywhere for everyone.",
              },
              {
                icon: Shuffle,
                title: "Agent exporters",
                text: "Generates rule files in each agent's native format & keeps existing settings.",
              },
              {
                icon: Users,
                title: "Solo & team modes",
                text: "Local-first for individuals. PR-friendly for team collaboration. Better for everyone.",
              },
              {
                icon: Settings,
                title: "Built-in customizability",
                text: "Use variables, path selectors & overlays for sharing + team friendly customization.",
              },
            ].map((item) => (
              <Card
                key={item.title}
                variant="feature"
                className="text-center border-[var(--card-border-subtle)] bg-card/90"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-primary text-primary-foreground">
                    <item.icon size={24} aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-6">
                    {item.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {(recentLoading || recent.length > 0) && (
        <section
          id="catalog"
          className="px-4 sm:px-6 py-16 bg-muted border-y border-border"
          aria-labelledby="ai-rule-catalog-heading"
        >
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="space-y-3 text-center">
              <SectionBadge>Discover Better Rules</SectionBadge>
              <h2
                id="ai-rule-catalog-heading"
                className="text-3xl md:text-4xl font-bold text-foreground"
              >
                AI rule catalog
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-3xl mx-auto leading-7 text-balance">
                See recently submitted rules below, browse the full{" "}
                <Link
                  href={{ pathname: "/catalog", hash: "catalog" }}
                  className="text-primary font-semibold hover:underline"
                >
                  rule catalog
                </Link>{" "}
                or{" "}
                <Link
                  href="/catalog"
                  className="text-primary font-semibold hover:underline"
                >
                  import & share&nbsp;
                </Link>
                your own.
              </p>
            </div>
            <Card className="bg-gradient-to-br from-card via-card/95 to-muted/70 border border-border/80 shadow-xl">
              <CardContent className="p-6 md:p-7 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-semibold text-foreground m-0">
                    Recent Aligns
                  </h3>
                  <Button asChild variant="outline" size="sm">
                    <Link href={{ pathname: "/catalog", hash: "catalog" }}>
                      View catalog
                    </Link>
                  </Button>
                  {recentLoading ? null : recent.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      No Aligns found
                    </span>
                  ) : null}
                </div>
                {recentLoading
                  ? renderSkeletonCards()
                  : recent.length > 0 && renderCards(recent)}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section
        className="px-4 sm:px-6 py-14 text-center cta-surface text-foreground overflow-hidden border border-white/30 dark:border-white/10 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.65)] ring-1 ring-black/5 dark:ring-white/5"
        aria-labelledby="cta-install-heading"
      >
        <div className="max-w-4xl mx-auto space-y-5">
          <SectionBadge variant="cta">Get started</SectionBadge>
          <h2
            id="cta-install-heading"
            className="text-3xl md:text-4xl font-bold leading-tight text-balance"
          >
            Make AI better for every agent you use & everyone you work with.
          </h2>
          <p className="text-base md:text-lg text-foreground/90 leading-7 max-w-2xl mx-auto text-pretty">
            Start syncing your AI rules across agents, repos & teams in 60
            seconds.
          </p>
          <div className="flex justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="font-semibold px-6 py-3 shadow-lg ring-1 ring-black/10 dark:ring-white/15 bg-white text-foreground hover:bg-white/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
            >
              <Link href="/install">Try AlignTrue CLI</Link>
            </Button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
