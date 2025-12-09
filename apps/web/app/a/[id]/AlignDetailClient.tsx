"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteHeader } from "@/app/components/SiteHeader";
import { SiteFooter } from "@/app/components/SiteFooter";
import {
  convertAlignContentForFormat,
  type TargetFormat,
} from "@/lib/aligns/format";
import {
  convertContent,
  type AgentId,
  type ConvertedContent,
} from "@/lib/aligns/convert";
import type { AlignRecord } from "@/lib/aligns/types";
import type { CachedContent, CachedPackFile } from "@/lib/aligns/content-cache";
import { buildPackZip, buildZipFilename } from "@/lib/aligns/zip-builder";
import { cn } from "@/lib/utils";

type Props = {
  align: AlignRecord;
  content: CachedContent | null;
};

const agentOptions: Array<{
  id: AgentId;
  label: string;
  description: string;
  format: TargetFormat;
  exporter: string;
}> = [
  {
    id: "all",
    label: "All agents (AGENTS.md)",
    description: "Default Align format, sync everywhere.",
    format: "align-md",
    exporter: "agents",
  },
  {
    id: "cursor",
    label: "Cursor (.cursor/rules/*.mdc)",
    description: "",
    format: "cursor-mdc",
    exporter: "cursor",
  },
  {
    id: "claude",
    label: "Claude Code (CLAUDE.md)",
    description: "",
    format: "align-md",
    exporter: "claude",
  },
  {
    id: "gemini",
    label: "Gemini (GEMINI.md)",
    description: "",
    format: "align-md",
    exporter: "gemini",
  },
  {
    id: "zed",
    label: "Zed (ZED.md)",
    description: "",
    format: "align-md",
    exporter: "zed",
  },
  {
    id: "warp",
    label: "Warp (WARP.md)",
    description: "",
    format: "align-md",
    exporter: "warp",
  },
  {
    id: "windsurf",
    label: "Windsurf (WINDSURF.md)",
    description: "",
    format: "align-md",
    exporter: "windsurf",
  },
  {
    id: "copilot",
    label: "GitHub Copilot (AGENTS.md)",
    description: "",
    format: "align-md",
    exporter: "agents",
  },
  {
    id: "cline",
    label: "Cline (.clinerules/*.md)",
    description: "",
    format: "align-md",
    exporter: "cline",
  },
  {
    id: "augmentcode",
    label: "AugmentCode (.augment/rules/*.md)",
    description: "",
    format: "align-md",
    exporter: "augmentcode",
  },
  {
    id: "amazonq",
    label: "Amazon Q (.amazonq/rules/*.md)",
    description: "",
    format: "align-md",
    exporter: "amazonq",
  },
  {
    id: "openhands",
    label: "OpenHands (.openhands/*.md)",
    description: "",
    format: "align-md",
    exporter: "openhands",
  },
  {
    id: "kiro",
    label: "Kiro (.kiro/steering/*.md)",
    description: "",
    format: "align-md",
    exporter: "kiro",
  },
];

function useShareUrl() {
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);
  return shareUrl;
}

async function postEvent(id: string, type: "view" | "install") {
  await fetch(`/api/aligns/${id}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}

function CopyButton({
  text,
  label,
  onCopied,
  variant = "ghost",
}: {
  text: string;
  label?: string;
  onCopied?: () => void;
  variant?: "ghost" | "primary";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 1400);
        } catch (err) {
          console.error("copy failed", err);
        }
      }}
      className={cn("min-w-[120px] font-semibold", {
        "border-border": variant !== "primary",
      })}
      variant={variant === "primary" ? "default" : "outline"}
    >
      {copied ? "✓ Copied" : (label ?? "Copy")}
    </Button>
  );
}

function ownerAndRepo(url: string): { owner: string; repo: string } {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return {
      owner: parts[0] ? `@${parts[0]}` : "unknown",
      repo: parts[1] ?? "unknown",
    };
  } catch {
    return { owner: "unknown", repo: "unknown" };
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function filenameFromUrl(url: string | undefined): string {
  if (!url) return "rules.md";
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.pop() ?? "rules.md";
  } catch {
    return "rules.md";
  }
}

export function AlignDetailClient({ align, content }: Props) {
  const [agent, setAgent] = useState<AgentId>("all");
  const [format, setFormat] = useState<TargetFormat>("align-md");
  const [actionTab, setActionTab] = useState<
    "share" | "global" | "temp" | "source" | "download"
  >("share");
  const [convertedCache, setConvertedCache] = useState<
    Map<string, ConvertedContent>
  >(new Map());
  const [converting, setConverting] = useState(false);
  const isPack =
    align.kind === "pack" &&
    content?.kind === "pack" &&
    Array.isArray(content.files) &&
    !!align.pack;
  const packFiles = isPack ? content.files : [];
  const [selectedPath, setSelectedPath] = useState<string>(
    isPack ? (packFiles[0]?.path ?? "") : "single",
  );
  const shareUrl = useShareUrl();

  useEffect(() => {
    void postEvent(align.id, "view");
  }, [align.id]);

  useEffect(() => {
    const selected = agentOptions.find((a) => a.id === agent);
    if (selected) setFormat(selected.format);
  }, [agent]);

  useEffect(() => {
    if (isPack) {
      setSelectedPath(packFiles[0]?.path ?? "");
    } else {
      setSelectedPath("single");
    }
  }, [isPack, packFiles]);

  const { owner, repo } = useMemo(
    () => ownerAndRepo(align.normalizedUrl),
    [align.normalizedUrl],
  );

  const selectedFile = useMemo(() => {
    if (!isPack) return null;
    return (
      packFiles.find((file) => file.path === selectedPath) ??
      packFiles[0] ??
      null
    );
  }, [isPack, packFiles, selectedPath]);

  const selectedContent = useMemo(() => {
    if (isPack) {
      return selectedFile?.content ?? "";
    }
    if (content?.kind === "single") return content.content;
    return "";
  }, [content, isPack, selectedFile]);

  const fileNameLabel = useMemo(
    () =>
      isPack
        ? ".align.yaml"
        : filenameFromUrl(align.normalizedUrl || align.url),
    [align.normalizedUrl, align.url, isPack],
  );

  const fileCountLabel = useMemo(() => {
    if (!isPack) return null;
    const count = packFiles.length;
    return count ? `${count} files` : null;
  }, [isPack, packFiles.length]);

  const totalBytes = useMemo(() => {
    if (isPack) {
      return (
        align.pack?.totalBytes ??
        packFiles.reduce((sum, file) => sum + (file.size ?? 0), 0)
      );
    }
    if (selectedContent) {
      return new TextEncoder().encode(selectedContent).length;
    }
    return null;
  }, [align.pack?.totalBytes, isPack, packFiles, selectedContent]);

  const sizeLabel = useMemo(
    () => (totalBytes ? formatBytes(totalBytes) : null),
    [totalBytes],
  );

  const commands = useMemo(() => {
    const selected =
      agentOptions.find((a) => a.id === agent) ?? agentOptions[0];
    const exporter = selected.exporter;
    const exporterFlag = exporter ? ` --exporters ${exporter}` : "";
    const globalInstall = "npm install -g aligntrue";
    const globalInit = `aligntrue init --source ${align.url}${exporterFlag}`;
    const tempInstall = `npx aligntrue init --source ${align.url}${exporterFlag}`;
    const addSource = `aligntrue add source ${align.url}\naligntrue sync${exporterFlag}`;
    return { globalInstall, globalInit, tempInstall, addSource, selected };
  }, [agent, align.url]);

  const cacheKey = useMemo(() => {
    const fileKey = isPack ? (selectedFile?.path ?? "single") : "single";
    return `${agent}::${fileKey}`;
  }, [agent, isPack, selectedFile]);

  // Live conversion (client-side using convertContent for now)
  useEffect(() => {
    if (!selectedContent) return;
    setConverting(true);
    try {
      setConvertedCache((prev) => {
        if (prev.get(cacheKey)) return prev;
        const converted = convertContent(selectedContent, agent);
        const next = new Map(prev);
        next.set(cacheKey, converted);
        return next;
      });
    } finally {
      setConverting(false);
    }
  }, [agent, cacheKey, selectedContent]);

  const cachedConverted = convertedCache.get(cacheKey);

  const shareText = shareUrl || align.normalizedUrl || align.url;
  const previewText =
    cachedConverted?.text ?? selectedContent ?? "Content unavailable.";
  const downloadFilename =
    cachedConverted?.filename ||
    (selectedContent
      ? convertAlignContentForFormat(selectedContent, format).filename
      : "align.md");

  const handleDownload = () => {
    if (!selectedContent) return;
    const source =
      cachedConverted?.text ??
      convertAlignContentForFormat(selectedContent, format).text;
    const filename =
      cachedConverted?.filename ||
      convertAlignContentForFormat(selectedContent, format).filename;
    if (!source) return;
    const ext = filename.split(".").pop() ?? "md";
    const mime =
      ext === "mdc"
        ? "text/markdown"
        : ext === "md"
          ? "text/markdown"
          : "text/plain";
    const blob = new Blob([source], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    if (!isPack || !packFiles.length) return;
    const zipFiles: CachedPackFile[] = packFiles.map((file) => {
      const converted = convertContent(file.content, agent);
      const dir = file.path.includes("/")
        ? file.path.slice(0, file.path.lastIndexOf("/"))
        : "";
      const zipPath = dir ? `${dir}/${converted.filename}` : converted.filename;
      const size = new TextEncoder().encode(converted.text).length;
      return { path: zipPath, size, content: converted.text };
    });
    const zipBlob = await buildPackZip(zipFiles);
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildZipFilename(align.pack?.manifestId ?? align.id);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span>{fileNameLabel}</span>
                {fileCountLabel && (
                  <>
                    <span>•</span>
                    <span>{fileCountLabel}</span>
                  </>
                )}
                {sizeLabel && (
                  <>
                    <span>•</span>
                    <span>{sizeLabel}</span>
                  </>
                )}
                <span>•</span>
                <span>Align ID: {align.id}</span>
                <span>•</span>
                <span>
                  {owner}/{repo}
                </span>
                <span>•</span>
                <a
                  href={align.normalizedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground hover:underline"
                >
                  View on GitHub
                </a>
              </div>
              {isPack && (
                <a
                  href="/docs/concepts/align-yaml-packs"
                  className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
                >
                  <HelpCircle size={16} />
                  How .align.yaml files work
                </a>
              )}
            </div>
            <div className="border-t border-border" />

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2 min-w-[240px] flex-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h1 className="text-3xl font-bold text-foreground m-0">
                    {align.title || "Untitled align"}
                  </h1>
                </div>
                {align.description && (
                  <p className="text-muted-foreground leading-relaxed m-0">
                    {align.description}
                  </p>
                )}
              </div>
              <div className="w-full sm:w-auto flex flex-col gap-1 min-w-[240px]">
                <span className="font-semibold text-foreground">
                  Agent export format
                </span>
                <Select
                  value={agent}
                  onValueChange={(value) => setAgent(value as AgentId)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Tabs
              value={actionTab}
              onValueChange={(v) => setActionTab(v as typeof actionTab)}
            >
              <TabsList className="w-full inline-flex h-10 items-center gap-2 border-b border-border px-4">
                {[
                  { id: "share", label: "Share Link" },
                  { id: "global", label: "Global Install" },
                  { id: "temp", label: "Temp Install" },
                  { id: "source", label: "Add Source" },
                  {
                    id: "download",
                    label: isPack ? "Download" : "Copy / Download",
                  },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="font-semibold"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="p-5 space-y-4">
                <TabsContent value="share" className="space-y-3">
                  <p className="text-muted-foreground">
                    Make it easy for others to use these rules. Copy this link
                    to share.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 bg-muted border border-border rounded-lg p-4">
                    <code className="flex-1 min-w-[280px] bg-background border border-border rounded-md p-3 font-mono text-sm whitespace-nowrap overflow-x-auto">
                      {shareText}
                    </code>
                    <CopyButton
                      text={shareText}
                      label="Copy"
                      variant="primary"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="global" className="space-y-3">
                  <p className="text-muted-foreground">
                    New to AlignTrue? Install globally to manage rules across
                    all your projects. Copy and run both commands together.{" "}
                    <a
                      href="/docs"
                      className="text-foreground font-semibold hover:underline"
                    >
                      Learn more about AlignTrue
                    </a>
                  </p>
                  <div className="flex flex-wrap items-center gap-3 bg-muted border border-border rounded-lg p-4">
                    <code className="flex-1 min-w-[280px] bg-background border border-border rounded-md p-3 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                      {`$ ${commands.globalInstall}\n$ ${commands.globalInit}`}
                    </code>
                    <CopyButton
                      text={`$ ${commands.globalInstall}\n$ ${commands.globalInit}`}
                      label="Copy"
                      variant="primary"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="temp" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 bg-muted border border-border rounded-lg p-4">
                    <div className="flex-1 min-w-[280px] space-y-2">
                      <p className="text-muted-foreground m-0">
                        Quick one-off install. No global install required.
                      </p>
                      <code className="block bg-background border border-border rounded-md p-3 font-mono text-sm whitespace-nowrap overflow-x-auto">
                        {commands.tempInstall}
                      </code>
                    </div>
                    <CopyButton
                      text={commands.tempInstall}
                      label="Copy"
                      variant="primary"
                      onCopied={() => void postEvent(align.id, "install")}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="source" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 bg-muted border border-border rounded-lg p-4">
                    <div className="flex-1 min-w-[280px] space-y-2">
                      <p className="text-muted-foreground m-0">
                        Already using AlignTrue? Add these rules as a connected
                        source.{" "}
                        <button
                          type="button"
                          onClick={() => setActionTab("global")}
                          className="text-foreground font-semibold underline"
                        >
                          New here? Use Global Install instead.
                        </button>
                      </p>
                      <code className="block bg-background border border-border rounded-md p-3 font-mono text-sm whitespace-pre-wrap overflow-x-auto leading-relaxed">
                        {commands.addSource
                          .split("\n")
                          .map((line) => `$ ${line}`)
                          .join("\n")}
                      </code>
                    </div>
                    <CopyButton
                      text={commands.addSource
                        .split("\n")
                        .map((line) => `$ ${line}`)
                        .join("\n")}
                      label="Copy"
                      variant="primary"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="download" className="space-y-3">
                  {!isPack && (
                    <>
                      <p className="text-muted-foreground">
                        Copy the rules to your clipboard or download the file to
                        add manually.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 bg-muted border border-border rounded-lg p-4">
                        <span className="flex-1 min-w-[280px] bg-background border border-border rounded-md p-3 font-semibold text-foreground">
                          {format === "align-md"
                            ? "Align (.md)"
                            : "Cursor (.mdc)"}
                        </span>
                        <CopyButton
                          text={
                            cachedConverted?.text ||
                            (selectedContent
                              ? convertAlignContentForFormat(
                                  selectedContent,
                                  format,
                                ).text
                              : "")
                          }
                          label="Copy"
                          variant="primary"
                        />
                        {selectedContent && (
                          <Button
                            onClick={handleDownload}
                            variant="outline"
                            className="font-semibold border-border"
                          >
                            Download ({downloadFilename})
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {isPack && align.pack && (
                    <>
                      <p className="text-muted-foreground">
                        Download all rules as a zip to add them to your project.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 bg-muted border border-border rounded-lg p-4">
                        <span className="flex-1 min-w-[280px] bg-background border border-border rounded-md p-3 font-semibold text-foreground">
                          {align.pack.manifestId} ({packFiles.length} rule
                          files)
                        </span>
                        <Button
                          onClick={handleDownloadAll}
                          variant="outline"
                          className="font-semibold border-border"
                        >
                          Download All (.zip)
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
            <CardTitle className="text-xl">Rule File Preview</CardTitle>
            {isPack && packFiles.length > 0 && (
              <Select
                value={selectedPath}
                onValueChange={(value) => setSelectedPath(value)}
              >
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {packFiles.map((file) => (
                    <SelectItem key={file.path} value={file.path}>
                      {file.path} ({formatBytes(file.size)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent>
            {!previewText && (
              <p className="text-muted-foreground">
                Content unavailable. Try refreshing; the source may be
                temporarily unreachable.
              </p>
            )}
            {previewText && (
              <pre className="bg-muted border border-border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[600px]">
                {converting ? "Converting..." : previewText}
              </pre>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
