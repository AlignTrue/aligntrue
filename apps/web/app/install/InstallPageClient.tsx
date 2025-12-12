"use client";

import Link from "next/link";
import { CommandBlock } from "@/components/CommandBlock";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const steps = [
  {
    step: "1",
    title: "Install",
    command: "npm install -g aligntrue",
    text: (
      <>
        Install once to manage AI agent rules (Cursor <code>.mdc</code>,{" "}
        <code>AGENTS.md</code>, <code>CLAUDE.md</code>, etc.).
      </>
    ),
  },
  {
    step: "2",
    title: "Init & sync",
    command: "aligntrue init",
    text: (
      <>
        Auto-detects existing rules, imports them, and syncs or creates smart
        defaults.
      </>
    ),
  },
] as const;

const installOptions = [
  {
    key: "npm",
    label: "npm",
    install: "npm install -g aligntrue",
    oneOff: "npx aligntrue init",
    note: "Recommended for most Node.js environments.",
  },
  {
    key: "yarn",
    label: "yarn",
    install: "yarn global add aligntrue",
    oneOff: "yarn dlx aligntrue init",
    note: "Use with Yarn global or dlx for one-off runs.",
  },
  {
    key: "pnpm",
    label: "pnpm",
    install: "pnpm add -g aligntrue",
    oneOff: "pnpm dlx aligntrue init",
    note: "Great for workspaces; use dlx for one-offs.",
  },
  {
    key: "bun",
    label: "bun",
    install: "bun install -g aligntrue",
    oneOff: "bunx aligntrue init",
    note: "Fast installs; bunx for ephemeral usage.",
  },
  {
    key: "npx",
    label: "npx",
    install: "npx aligntrue init",
    oneOff: "npx aligntrue sync",
    note: "No global install. Slightly slower on first run.",
  },
] as const;

const faqs = [
  {
    question: "How long does setup take?",
    answer:
      "Under 60 seconds: npm install -g aligntrue → aligntrue init → aligntrue sync. Init auto-detects agent files and writes config plus exports.",
  },
  {
    question: "What if I already have agent configs?",
    answer:
      "Run aligntrue init in your repo. It finds existing agent files, offers to import them into .aligntrue/rules, and syncs exports on next run.",
  },
  {
    question: "AlignTrue command not found",
    answer:
      "Install globally (npm/yarn/pnpm/bun) or run via npx/bunx. If globally installed, ensure your global bin directory is on PATH.",
  },
  {
    question: "Do I need to install anything else?",
    answer:
      "Just Node.js 20+ and an AI agent (Cursor, GitHub Copilot, Claude Code, etc.). AlignTrue works offline after install.",
  },
  {
    question: "Does AlignTrue require network access?",
    answer:
      "No, it is local-first. Network is only used when you opt to pull rules from remote git sources (e.g., aligntrue init --source <repo>).",
  },
] as const;

export function InstallPageClient() {
  return (
    <PageLayout>
      <section
        className="relative text-center px-4 py-14 md:py-18 hero-surface hero-background"
        aria-labelledby="install-hero-heading"
      >
        <div className="grid-pattern" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto space-y-10">
          <div className="space-y-4">
            <h1
              id="install-hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight text-foreground max-w-5xl mx-auto text-balance"
            >
              Install AlignTrue CLI
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto text-pretty">
              Start in 60 seconds. Write rules once & sync to 20+ agents with{" "}
              <code>aligntrue sync</code>.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-5xl mx-auto">
            {steps.map((card) => (
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
                  <CommandBlock
                    code={card.command}
                    copyLabel="Copy"
                    showPrompt
                  />
                  <p className="text-sm text-muted-foreground leading-6 text-balance">
                    {card.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="px-5 py-2.5">
              <Link href="/docs/00-getting-started/00-quickstart">
                Quickstart guide
              </Link>
            </Button>
            <Button asChild variant="outline" className="px-5 py-2.5">
              <Link href="/docs">Read docs</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <Card variant="surface">
          <CardHeader>
            <CardTitle className="text-xl">
              Choose your install method
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Use your preferred package manager or run one-off commands without
              a global install.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="npm" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                {installOptions.map((option) => (
                  <TabsTrigger key={option.key} value={option.key}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {installOptions.map((option) => (
                <TabsContent
                  key={option.key}
                  value={option.key}
                  className="mt-4"
                >
                  <div className="space-y-3">
                    <CommandBlock code={option.install} copyLabel="Copy" />
                    {option.oneOff && (
                      <CommandBlock
                        code={option.oneOff}
                        copyLabel="Copy"
                        description="One-off or CI-friendly run"
                      />
                    )}
                    <p className="text-sm text-muted-foreground">
                      {option.note}
                    </p>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card variant="surface">
          <CardHeader>
            <CardTitle className="text-xl">Prerequisites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-2">
              <li>
                Node.js 20+ —{" "}
                <a
                  href="https://nodejs.org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  download
                </a>
              </li>
              <li>
                An AI coding agent — see{" "}
                <Link
                  href="/docs/04-reference/agent-support"
                  className="text-primary hover:underline"
                >
                  supported agents
                </Link>
                .
              </li>
              <li>
                Git (optional) if you plan to import rules from remote sources.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card variant="surface">
          <CardHeader>
            <CardTitle className="text-xl">FAQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group rounded-lg border border-border bg-muted/50 px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground leading-6">
                  {item.answer}
                </p>
              </details>
            ))}
          </CardContent>
        </Card>

        <Card variant="surface">
          <CardHeader>
            <CardTitle className="text-xl">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/docs/00-getting-started/00-quickstart">
                Quickstart
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/docs/04-reference/agent-support">Agent support</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/docs/04-reference/cli-reference">CLI reference</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}
