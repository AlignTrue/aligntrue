"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Settings,
  Shuffle,
  Users,
  Zap,
} from "lucide-react";
import { HowItWorksDiagram } from "./components/HowItWorksDiagram";
import { GitHubIcon } from "./components/GitHubIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { getSubmittedUrlFromSearch } from "@/lib/aligns/urlFromSearch";
import { CommandBlock } from "@/components/CommandBlock";
import { PageLayout } from "@/components/PageLayout";
import { SkeletonCard } from "@/components/SkeletonCard";
import { AlignCard, type AlignSummary } from "./components/AlignCard";

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

export function HomePageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"rules" | "cli">("rules");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<AlignSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    const candidate = getSubmittedUrlFromSearch(window.location.search);
    if (!candidate) return;
    setUrlInput(candidate);
    setActiveTab("rules");
    void (async () => {
      setSubmitting(true);
      setError(null);
      try {
        const id = await submitUrl(candidate);
        router.push(`/a/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    void (async () => {
      setRecentLoading(true);
      setRecent(await fetchList("/api/aligns/recent?limit=8"));
      setRecentLoading(false);
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

  const renderRulesTab = () => (
    <Card className="max-w-5xl mx-auto" variant="surface">
      <CardContent className="p-6 md:p-7 space-y-6">
        <div className="space-y-3">
          <label className="font-semibold text-foreground" htmlFor="align-url">
            Enter a GitHub URL with AI rules (.mdc, .md, etc.)
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
                "Generate Align"
              )}
            </Button>
          </div>
          {error && (
            <p
              className="text-sm font-semibold text-destructive m-0"
              aria-live="polite"
            >
              {error}
            </p>
          )}
        </div>

        {(recentLoading || recent.length > 0) && (
          <section className="pt-2 space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Recent Aligns
            </h3>
            {recentLoading ? renderSkeletonCards() : renderCards(recent)}
          </section>
        )}
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
              <TabsTrigger value="cli" className="text-base px-4 py-2">
                Install CLI
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-base px-4 py-2">
                Import Rules
              </TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="cli">{renderCLITab()}</TabsContent>
              <TabsContent value="rules">{renderRulesTab()}</TabsContent>
            </div>
          </Tabs>

          <div
            className="flex flex-wrap justify-center gap-3 fade-in-up"
            data-delay="4"
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
        className="bg-muted border-y border-border px-4 py-12"
        aria-labelledby="how-it-works-heading"
      >
        <div className="max-w-6xl mx-auto">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-bold text-center mt-2 mb-5 text-foreground"
          >
            How it works
          </h2>
          <div className="max-w-4xl mx-auto">
            <HowItWorksDiagram />
          </div>
          <p className="text-center mt-6 text-base text-muted-foreground max-w-3xl mx-auto leading-7 text-balance">
            Write your rules once & run <code>aligntrue sync</code>. AlignTrue
            automatically generates agent-specific formats for all your AI tools
            or team members.
          </p>
        </div>
      </section>

      <section
        className="bg-muted border-b border-border px-4 py-12"
        aria-labelledby="features-heading"
      >
        <div className="max-w-6xl mx-auto">
          <h2 id="features-heading" className="sr-only">
            Key Features
          </h2>
          <div className="grid gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto place-items-center">
            {[
              {
                icon: Zap,
                title: "60-second setup",
                text: "Auto-detects agents & generates rules in under a minute. No config required.",
              },
              {
                icon: RefreshCw,
                title: "Automatic sync",
                text: "Edit rules once & sync to all agents. No more manual copying or outdated rules.",
              },
              {
                icon: Globe,
                title: "Works with 20+ agents",
                text: "Cursor, Codex, Claude Code, Copilot, Aider, Windsurf, VS Code MCP & more.",
              },
            ].map((feature) => (
              <Card key={feature.title} className="h-full" variant="feature">
                <CardContent className="p-5 space-y-3 text-center">
                  <feature.icon
                    size={32}
                    className="text-primary transition-transform duration-200 mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-6">
                    {feature.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        className="max-w-6xl mx-auto px-4 sm:px-6 py-16"
        aria-labelledby="rule-wrangling-heading"
      >
        <h2
          id="rule-wrangling-heading"
          className="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground"
        >
          Rule-wrangling, solved.
        </h2>
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
            <Card key={item.title} variant="feature" className="text-center">
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
      </section>
    </PageLayout>
  );
}
