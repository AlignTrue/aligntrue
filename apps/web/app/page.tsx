import type { Metadata } from "next";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@aligntrue/ui-base";
import { SectionBadge } from "./components/SectionBadge";
import { PageLayout } from "@/components/PageLayout";
import { GitHubIcon } from "./components/GitHubIcon";

const title = "AlignTrue | AI ops platform (experimental alpha)";
const description =
  "Deterministic, receipts-first AI ops platform. Local-first, rebuildable projections, and governed connectors.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    images: [
      {
        url: "/aligntrue-og-image.png",
        width: 1800,
        height: 945,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/aligntrue-og-image.png"],
  },
};

export default function HomePage() {
  return (
    <PageLayout>
      <section
        id="page-top"
        className="relative text-center px-4 py-16 md:py-20 bg-gradient-to-b from-background via-background to-muted/30"
        aria-labelledby="hero-heading"
      >
        <div className="relative max-w-5xl mx-auto space-y-8">
          <SectionBadge>Experimental alpha</SectionBadge>
          <h1
            id="hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight text-foreground text-balance"
          >
            AI ops with receipts, replay, and deterministic projections.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto text-pretty">
            AlignTrue is an experimental, local-first AI ops platform focused on
            deterministic behavior, envelopes-first design, and rebuildable
            projections so teams can trust AI outputs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-5 py-3 font-semibold">
              <a
                href="https://github.com/AlignTrue/aligntrue"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2"
              >
                <GitHubIcon size={18} />
                View repository
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 justify-center items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/ci.yml?label=CI&logo=github"
              alt="CI status"
              className="h-6"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/license-MIT-blue"
              alt="MIT License"
              className="h-6"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/badge/node-%3E%3D20-brightgreen"
              alt="Node 20+"
              className="h-6"
            />
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-14 bg-muted/40 border-y border-border">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              What&apos;s inside
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto leading-7 text-pretty">
              Kernel, host runtime, connectors, packs, and UI blocks bundled for
              supervised AI execution. Everything is rebuildable offline.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Receipts-first kernel",
                text: "Core event log, deterministic envelopes, rebuildable projections, and idempotent outbox.",
              },
              {
                title: "Host + connectors",
                text: "Runtime dispatch with governed safety classes and connectors (e.g., Gmail, Calendar).",
              },
              {
                title: "Packs + UI blocks",
                text: "Versioned packs for tasks/notes/convert/suggestions plus renderer-ready UI blocks.",
              },
              {
                title: "Local-first, OSS",
                text: "Runs offline with fixtures. MIT-licensed. Designed for repeatable CI and audit trails.",
              },
            ].map((item) => (
              <Card key={item.title} className="h-full border-border/80">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-6">
                  {item.text}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-5">
          <SectionBadge>Alpha notice</SectionBadge>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground">
            Experimental. Expect changes.
          </h3>
          <p className="text-base md:text-lg text-muted-foreground leading-7 text-pretty">
            Interfaces, connectors, and UI contracts may change rapidly while we
            dogfood the architecture. Contributions and issues are welcome in
            the GitHub repo.
          </p>
          <div className="flex justify-center">
            <Button asChild variant="outline" size="lg" className="px-6 py-3">
              <a
                href="https://github.com/AlignTrue/aligntrue"
                target="_blank"
                rel="noreferrer"
              >
                Star on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
