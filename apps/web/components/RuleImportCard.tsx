"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type RuleImportCardProps = {
  onSuccess?: (id: string) => void;
  loadingText?: string;
  initialUrl?: string;
  autoSubmitOnInitialUrl?: boolean;
  className?: string;
};

type SubmitResult = { id: string };

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

export function RuleImportCard({
  onSuccess,
  loadingText = "Importing...",
  initialUrl,
  autoSubmitOnInitialUrl = false,
  className,
}: RuleImportCardProps) {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorIssueUrl, setErrorIssueUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const autoSubmittedUrlRef = useRef<string | null>(null);

  const handleSuccess = onSuccess ?? ((id: string) => router.push(`/a/${id}`));

  const submitAndHandle = async (target?: string) => {
    const value = target ?? urlInput;
    if (!value) {
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
      const { id } = await submitUrl(value);
      handleSuccess(id);
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

  useEffect(() => {
    if (!initialUrl) return;
    setUrlInput(initialUrl);
    if (autoSubmitOnInitialUrl && autoSubmittedUrlRef.current !== initialUrl) {
      autoSubmittedUrlRef.current = initialUrl;
      void submitAndHandle(initialUrl);
    }
  }, [initialUrl, autoSubmitOnInitialUrl]);

  const cardClassName = className ?? "max-w-4xl mx-auto text-left";

  return (
    <Card className={cardClassName} variant="surface">
      <CardContent className="p-6 md:p-7 space-y-6">
        <div className="space-y-3">
          <label
            className="font-semibold text-foreground block mb-2"
            htmlFor="align-url"
          >
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
              onClick={() => void submitAndHandle()}
              disabled={submitting}
              className="h-12 px-5 font-semibold"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" />
                  {loadingText}
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
}
