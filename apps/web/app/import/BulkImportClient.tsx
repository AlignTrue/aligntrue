"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";

import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  validateAlignUrls,
  type UrlValidationResult,
} from "@/lib/aligns/url-validation";
import { DESCRIPTION_MAX_CHARS } from "@/lib/aligns/constants";
import { useDebounce } from "@/lib/useDebounce";

type BulkResult =
  | { url: string; status: "success"; id: string; title?: string | null }
  | { url: string; status: "error"; error: string };

type BulkSubmitPayload = {
  urls: string[];
  createPack?: {
    title: string;
    description: string;
    author?: string;
  };
};

export function BulkImportClient() {
  const [urlsText, setUrlsText] = useState("");
  const [validation, setValidation] = useState<{
    results: UrlValidationResult[];
    allValid: boolean;
    uniqueOwners: string[];
    limited: boolean;
  } | null>(null);
  const [packEnabled, setPackEnabled] = useState(false);
  const [packTitle, setPackTitle] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packAuthor, setPackAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [packResult, setPackResult] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const urls = useMemo(
    () =>
      urlsText
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
    [urlsText],
  );

  const debouncedUrls = useDebounce(urls, 300);

  const validCount = validation?.results.filter((r) => r.valid).length ?? 0;

  useEffect(() => {
    const res = validateAlignUrls(debouncedUrls);
    setValidation(res);
    setError(null);
    if (res.allValid && res.uniqueOwners.length === 1) {
      setPackAuthor(res.uniqueOwners[0] ?? "");
    }
  }, [debouncedUrls]);

  const handleSubmit = async () => {
    const currentValidation = validation ?? validateAlignUrls(urls);
    if (!validation) {
      setValidation(currentValidation);
    }
    if (!currentValidation.results.length) {
      setError("Enter at least one URL.");
      return;
    }
    if (!currentValidation.allValid) {
      setError("Fix validation errors before importing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResults(null);
    setPackResult(null);
    try {
      const payload: BulkSubmitPayload = { urls };
      if (packEnabled) {
        if (!packTitle.trim() || !packDescription.trim()) {
          setError("Pack title and description are required.");
          setSubmitting(false);
          return;
        }
        payload.createPack = {
          title: packTitle.trim(),
          description: packDescription.trim(),
          author: packAuthor.trim() || undefined,
        };
      }
      const response = await fetch("/api/aligns/bulk-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "Bulk import failed");
      } else {
        setResults(data.results as BulkResult[]);
        setPackResult(data.pack ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderValidation = () => {
    if (!validation) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{validCount} valid</Badge>
          <Badge variant="outline">
            {validation.uniqueOwners.length} author
            {validation.uniqueOwners.length === 1 ? "" : "s"}
          </Badge>
          {validation.limited && (
            <Badge variant="destructive">Trimmed to 50 URLs</Badge>
          )}
        </div>
        <div className="space-y-1">
          {validation.results.map((res, idx) => {
            const Icon = res.valid ? CheckCircle : XCircle;
            const color = res.valid ? "text-green-600" : "text-destructive";
            return (
              <div
                key={`${res.url}-${idx}`}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon className={color} size={16} aria-hidden />
                <span className="truncate">{res.url}</span>
                {!res.valid && res.error && (
                  <span className="text-destructive">— {res.error}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;
    return (
      <div className="space-y-3">
        {packResult && (
          <Card variant="surface">
            <CardHeader>
              <CardTitle className="text-base">Pack created</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle
                    className="text-green-600"
                    size={16}
                    aria-hidden
                  />
                  <span>{packResult.url}</span>
                </div>
                <a
                  href={packResult.url}
                  className="text-primary hover:underline font-semibold text-sm"
                >
                  Open →
                </a>
              </div>
            </CardContent>
          </Card>
        )}
        <Card variant="surface">
          <CardHeader>
            <CardTitle className="text-base">Imported rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {results.map((r) => {
              const Icon =
                r.status === "success"
                  ? CheckCircle
                  : r.status === "error"
                    ? XCircle
                    : AlertCircle;
              const color =
                r.status === "success"
                  ? "text-green-600"
                  : r.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground";
              return (
                <div
                  key={`${r.url}-${r.status}`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={color} size={16} aria-hidden />
                    <span className="truncate">{r.url}</span>
                  </div>
                  {r.status === "success" && (
                    <a
                      href={`/a/${r.id}`}
                      className="text-primary hover:underline font-semibold"
                    >
                      Open →
                    </a>
                  )}
                  {r.status === "error" && (
                    <span className="text-destructive text-xs">{r.error}</span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <PageLayout>
      <section className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Bulk import</h1>
          <p className="text-muted-foreground">
            Paste multiple GitHub URLs (one per line). Optionally bundle them as
            a shareable pack. URLs are validated as you type.
          </p>
        </div>

        <Card variant="surface">
          <CardHeader>
            <CardTitle className="text-lg">1. Add URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder="https://github.com/org/repo/blob/main/rules/a.md&#10;https://github.com/org/repo/blob/main/rules/b.md"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  id="pack-enabled"
                  checked={packEnabled}
                  onCheckedChange={(val) => setPackEnabled(Boolean(val))}
                />
                <label htmlFor="pack-enabled" className="cursor-pointer">
                  Bundle as shareable pack (rules remain individually available)
                </label>
              </div>
            </div>
            {validation && renderValidation()}
          </CardContent>
        </Card>

        {packEnabled && (
          <Card variant="surface">
            <CardHeader>
              <CardTitle className="text-lg">2. Pack details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Title *</label>
                <Input
                  value={packTitle}
                  onChange={(e) => setPackTitle(e.target.value)}
                  placeholder="Great align pack name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Description *</label>
                <Textarea
                  value={packDescription}
                  onChange={(e) => setPackDescription(e.target.value)}
                  maxLength={DESCRIPTION_MAX_CHARS}
                  placeholder="Short description to help others understand and install together."
                />
                <div className="text-xs text-muted-foreground">
                  {packDescription.length}/{DESCRIPTION_MAX_CHARS}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Author (auto-detected when possible)
                </label>
                <Input
                  value={packAuthor}
                  onChange={(e) => setPackAuthor(e.target.value)}
                  placeholder="@username"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                Importing...
              </span>
            ) : (
              "Import"
            )}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        {renderResults()}
      </section>
    </PageLayout>
  );
}
