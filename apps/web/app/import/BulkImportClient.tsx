"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Folder,
  HelpCircle,
  Loader2,
  X,
  XCircle,
} from "lucide-react";

import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  isDirectoryUrl,
  validateAlignUrl,
  validateAlignUrls,
} from "@/lib/aligns/url-validation";
import { filenameFromUrl } from "@/lib/aligns/urlUtils";
import {
  BULK_IMPORT_MAX_URLS,
  DESCRIPTION_MAX_CHARS,
  TITLE_MAX_CHARS,
} from "@/lib/aligns/constants";
import { useDebounce } from "@/lib/useDebounce";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

type ValidatedItem = {
  id: string;
  type: "file" | "directory";
  url: string;
  displayName: string;
  parentDirId?: string;
  valid: boolean;
  error?: string;
  expanding?: boolean;
  owner?: string;
};

export function BulkImportClient() {
  const idCounterRef = useRef(0);
  const makeId = (prefix: string) => {
    idCounterRef.current += 1;
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${idCounterRef.current}`;
  };

  const [urlsText, setUrlsText] = useState("");
  const [packEnabled, setPackEnabled] = useState(false);
  const [packTitle, setPackTitle] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packAuthor, setPackAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [packResult, setPackResult] = useState<{
    id: string;
    url: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ValidatedItem[]>([]);

  const urls = useMemo(
    () =>
      urlsText
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
    [urlsText],
  );

  const debouncedUrls = useDebounce(urls, 300);

  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      if (!debouncedUrls.length) return;

      const fileUrls = debouncedUrls.filter((u) => !isDirectoryUrl(u));
      const dirEntries = debouncedUrls
        .filter((u) => isDirectoryUrl(u))
        .map((url, idx) => ({
          url,
          id: makeId(`dir-${idx}`),
        }));

      const fileValidation = validateAlignUrls(fileUrls);

      const baseItems: ValidatedItem[] = fileValidation.results.map(
        (res, idx) => ({
          id: makeId(`file-${idx}`),
          type: "file",
          url: res.normalized?.normalizedUrl ?? res.url,
          displayName:
            res.filename ??
            res.normalized?.filename ??
            res.url.split("/").pop() ??
            res.url,
          valid: res.valid,
          error: res.error,
          owner: res.owner,
        }),
      );

      // Seed directory placeholders
      dirEntries.forEach(({ url: dirUrl, id }) => {
        const dirName =
          new URL(dirUrl).pathname.split("/").filter(Boolean).pop() ?? dirUrl;
        baseItems.push({
          id,
          type: "directory",
          url: dirUrl,
          displayName: dirName,
          valid: true,
          expanding: true,
        });
      });

      setItems(baseItems);
      setError(null);

      await Promise.all(
        dirEntries.map(async ({ url: dirUrl, id: dirId }) => {
          const placeholderName =
            new URL(dirUrl).pathname.split("/").filter(Boolean).pop() ?? dirUrl;

          // Ensure placeholder exists if it wasn't added above (unlikely but safe)
          setItems((prev) => {
            const hasDir = prev.some((i) => i.id === dirId);
            if (hasDir) return prev;
            return [
              ...prev,
              {
                id: dirId,
                type: "directory",
                url: dirUrl,
                displayName: placeholderName,
                valid: true,
                expanding: true,
              },
            ];
          });

          const response = await fetch("/api/aligns/expand-directory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: dirUrl }),
          });

          if (cancelled) return;

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setItems((prev) =>
              prev.map((item) =>
                item.id === dirId
                  ? {
                      ...item,
                      expanding: false,
                      valid: false,
                      error: data?.error ?? "Could not expand directory.",
                    }
                  : item,
              ),
            );
            return;
          }

          const data = (await response.json()) as {
            files: Array<{ url: string; filename: string }>;
            dirname?: string;
          };

          setItems((prev) => {
            const seen = new Set(
              prev
                .filter((i) => i.type === "file" && i.valid && !i.error)
                .map((i) => i.url.toLowerCase()),
            );

            const updatedDirName = data.dirname ?? placeholderName;

            const mapped = prev.map((item) =>
              item.id === dirId
                ? {
                    ...item,
                    displayName: updatedDirName,
                    expanding: false,
                    valid: data.files.length > 0,
                    error:
                      data.files.length === 0
                        ? "No rule files found in this directory."
                        : undefined,
                  }
                : item,
            );

            const additions: ValidatedItem[] = [];
            data.files
              .slice(0, BULK_IMPORT_MAX_URLS)
              .forEach((file, fileIdx) => {
                const res = validateAlignUrl(file.url);
                const key =
                  res.normalized?.normalizedUrl?.toLowerCase() ??
                  res.url.toLowerCase();
                const duplicate = res.valid && seen.has(key);

                additions.push({
                  id: makeId(`file-${dirId}-${fileIdx}`),
                  type: "file",
                  url: res.normalized?.normalizedUrl ?? res.url,
                  displayName: file.filename ?? res.filename ?? res.url,
                  parentDirId: dirId,
                  valid: res.valid && !duplicate,
                  error: !res.valid
                    ? res.error
                    : duplicate
                      ? "Duplicate URL detected"
                      : undefined,
                  owner: res.owner,
                });

                if (res.valid && !duplicate) {
                  seen.add(key);
                }
              });

            return [...mapped, ...additions];
          });
        }),
      );
    };

    void process();

    return () => {
      cancelled = true;
    };
  }, [debouncedUrls]);

  useEffect(() => {
    const validOwners = items
      .filter((i) => i.type === "file" && i.valid && !i.error && i.owner)
      .map((i) => i.owner as string);
    const uniqueOwners = Array.from(new Set(validOwners));
    if (uniqueOwners.length === 1) {
      setPackAuthor((prev) => prev || uniqueOwners[0] || "");
    }
  }, [items]);

  const handleSubmit = async () => {
    const importable = items.filter(
      (i) => i.type === "file" && i.valid && !i.error,
    );
    if (!importable.length) {
      setError("Add at least one valid rule file to import.");
      return;
    }

    const urlsToImport = importable.map((i) => i.url);

    setSubmitting(true);
    setError(null);
    setResults(null);
    setPackResult(null);
    try {
      const payload: BulkSubmitPayload = { urls: urlsToImport };
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
        setPackResult(
          data.pack
            ? {
                ...data.pack,
                title: data.pack.title ?? packTitle.trim(),
              }
            : null,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;

      let next = prev.filter((i) => i.id !== id);

      if (item.type === "directory") {
        next = next.filter((i) => i.parentDirId !== id);
      }

      if (item.parentDirId) {
        const siblingsRemain = next.some(
          (i) => i.parentDirId === item.parentDirId,
        );
        if (!siblingsRemain) {
          next = next.filter((i) => i.id !== item.parentDirId);
        }
      }

      return next;
    });
  };

  const directories = items.filter((i) => i.type === "directory");
  const standaloneFiles = items.filter(
    (i) => i.type === "file" && !i.parentDirId,
  );

  const renderChip = (item: ValidatedItem) => {
    const Icon = item.type === "directory" ? Folder : FileText;
    const color =
      item.type === "directory"
        ? "bg-muted text-foreground"
        : item.valid && !item.error
          ? "bg-secondary text-foreground"
          : "bg-destructive/10 text-destructive border border-destructive/30";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${color}`}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-[220px] truncate">{item.displayName}</span>
              {item.expanding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="focus:outline-none"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="max-w-xs break-all text-xs">{item.url}</p>
            {item.error && (
              <p className="text-destructive text-xs mt-1">{item.error}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle
                    className="text-green-600 shrink-0"
                    size={16}
                    aria-hidden
                  />
                  <a
                    href={packResult.url}
                    className="font-semibold text-foreground hover:underline truncate"
                  >
                    {packResult.title}
                  </a>
                </div>
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
              const label = r.title ?? filenameFromUrl(r.url);
              return (
                <div
                  key={`${r.url}-${r.status}`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`${color} shrink-0`}
                      size={16}
                      aria-hidden
                    />
                    <span className="truncate">
                      {r.status === "success" ? (
                        <a
                          href={`/a/${r.id}`}
                          className="text-foreground hover:underline font-semibold"
                        >
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </span>
                  </div>
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
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">1. Add URLs</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">
                      Paste file or directory URLs from GitHub. Directories
                      expand to show rule files you can remove before import.
                    </p>
                    <a
                      href="/docs/01-guides/10-align-catalog#bulk-import-and-packs-catalog"
                      className="text-primary hover:underline text-sm"
                    >
                      Learn more
                    </a>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={`Paste file or directory URLs (one per line). Examples:
https://github.com/org/repo/blob/main/rules/rule.md
https://gist.github.com/user/abc123
https://github.com/org/repo/tree/main/.cursor/rules`}
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">
                        Align packs bundle rules together for easy sharing and
                        installation.
                      </p>
                      <a
                        href="/docs/03-concepts/align-packs"
                        className="text-primary hover:underline text-sm"
                      >
                        Learn about packs
                      </a>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="space-y-3">
              {directories.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Folder className="h-4 w-4" />
                    <span>Directories</span>
                  </div>
                  <div className="space-y-2">
                    {directories.map((dir) => (
                      <div key={dir.id} className="space-y-2">
                        {renderChip(dir)}
                        <div className="flex flex-wrap gap-2 pl-6">
                          {items
                            .filter((i) => i.parentDirId === dir.id)
                            .map((child) => (
                              <div key={child.id}>{renderChip(child)}</div>
                            ))}
                          {!items.some((i) => i.parentDirId === dir.id) &&
                            !dir.expanding &&
                            dir.error && (
                              <span className="text-xs text-destructive">
                                {dir.error}
                              </span>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {standaloneFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4" />
                    <span>Standalone files</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {standaloneFiles.map((file) => (
                      <div key={file.id}>{renderChip(file)}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {packEnabled && (
          <Card variant="surface">
            <CardHeader>
              <CardTitle className="text-lg">2. Align pack details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Title *</label>
                <div className="relative">
                  <Input
                    value={packTitle}
                    onChange={(e) => setPackTitle(e.target.value)}
                    maxLength={TITLE_MAX_CHARS}
                    placeholder="Pick a descriptive name..."
                    className="pr-16"
                  />
                  <span
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${
                      packTitle.length >= TITLE_MAX_CHARS
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {packTitle.length}/{TITLE_MAX_CHARS}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Description *</label>
                <div className="relative">
                  <Textarea
                    value={packDescription}
                    onChange={(e) => setPackDescription(e.target.value)}
                    maxLength={DESCRIPTION_MAX_CHARS}
                    placeholder="Describe what this Align pack is useful for."
                    className="pb-6"
                  />
                  <span
                    className={`absolute bottom-2 right-3 text-xs pointer-events-none ${
                      packDescription.length >= DESCRIPTION_MAX_CHARS
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {packDescription.length}/{DESCRIPTION_MAX_CHARS}
                  </span>
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
