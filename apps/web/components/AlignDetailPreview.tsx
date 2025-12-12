"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodePreview } from "@/components/CodePreview";
import { CommandBlock } from "@/components/CommandBlock";
import { agentOptions } from "@/lib/aligns/agents";
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
import { downloadFile } from "@/lib/download";
import { filenameFromUrl, parseGitHubUrl } from "@/lib/aligns/urlUtils";
import { formatBytes } from "@/lib/utils";

const EMPTY_PACK_FILES: CachedPackFile[] = [];

export type AlignDetailPreviewProps = {
  align: AlignRecord;
  content: CachedContent | null;
  className?: string;
};

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

export function AlignDetailPreview({
  align,
  content,
  className,
}: AlignDetailPreviewProps) {
  const [agent, setAgent] = useState<AgentId>("all");
  const [format, setFormat] = useState<TargetFormat>("align-md");
  const [actionTab, setActionTab] = useState<
    "share" | "global" | "temp" | "source"
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
  const packFiles = isPack ? content.files : EMPTY_PACK_FILES;
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

  const { owner, ownerUrl } = useMemo(
    () => parseGitHubUrl(align.normalizedUrl),
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

  const selectedAgent = useMemo(
    () => agentOptions.find((a) => a.id === agent),
    [agent],
  );
  const canExport = selectedAgent?.capabilities?.cliExport !== false;

  useEffect(() => {
    if (!canExport && actionTab !== "share") {
      setActionTab("share");
    }
  }, [actionTab, canExport]);

  const commands = useMemo(() => {
    const selected = selectedAgent ?? agentOptions[0];
    const exporter = selected.exporter;
    const exporterFlag =
      canExport && exporter ? ` --exporters ${exporter}` : "";
    const globalInstall = "npm install -g aligntrue";
    const globalInit = `aligntrue init --source ${align.url}${exporterFlag}`;
    const tempInstall = `npx aligntrue init --source ${align.url}${exporterFlag}`;
    const addSource = `aligntrue add source ${align.url}\naligntrue sync${exporterFlag}`;
    return { globalInstall, globalInit, tempInstall, addSource, selected };
  }, [align.url, canExport, selectedAgent]);

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
  const previewFilename = isPack
    ? selectedPath || align.pack?.manifestId || "rules.md"
    : downloadFilename;
  const downloadAllFilename = useMemo(
    () => buildZipFilename(align.pack?.manifestId ?? align.id),
    [align.id, align.pack?.manifestId],
  );

  const handleDownload = async () => {
    if (!selectedContent) return;
    const converted =
      cachedConverted ?? convertAlignContentForFormat(selectedContent, format);
    if (!converted.text) return;
    await downloadFile(converted.text, converted.filename);
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
    const zipWithMime =
      zipBlob.type === "application/zip"
        ? zipBlob
        : zipBlob.slice(0, zipBlob.size, "application/zip");
    await downloadFile(zipWithMime, downloadAllFilename);
  };

  const downloadButton = isPack ? (
    packFiles.length ? (
      <Button
        onClick={handleDownloadAll}
        variant="outline"
        size="sm"
        className="font-semibold w-full sm:w-auto sm:min-w-[140px] h-10 text-sm"
      >
        Download All (.zip)
      </Button>
    ) : null
  ) : selectedContent ? (
    <Button
      onClick={handleDownload}
      variant="outline"
      size="sm"
      className="font-semibold w-full sm:w-auto sm:min-w-[140px] h-10 text-sm"
    >
      Download ({downloadFilename})
    </Button>
  ) : null;

  return (
    <div className={className}>
      <Card variant="surface">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-foreground m-0 leading-tight">
                    {align.title || "Untitled align"}
                  </h1>
                </div>
                {align.description && (
                  <p className="text-muted-foreground leading-relaxed m-0">
                    {align.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:justify-end">
                <div className="flex items-center gap-2">
                  <a
                    href={align.normalizedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-foreground hover:underline"
                  >
                    {fileNameLabel}
                  </a>
                  {isPack && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href="/docs/03-concepts/align-packs"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Learn how Align packs work"
                          >
                            <HelpCircle size={18} />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>
                          Learn how Align packs work
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">by</span>
                {ownerUrl ? (
                  <a
                    href={ownerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-foreground hover:underline"
                  >
                    {owner}
                  </a>
                ) : (
                  <span className="font-semibold text-foreground">{owner}</span>
                )}
                {(fileCountLabel || sizeLabel) && (
                  <Badge variant="outline" className="font-semibold">
                    {fileCountLabel}
                    {fileCountLabel && sizeLabel ? " · " : ""}
                    {sizeLabel}
                  </Badge>
                )}
              </div>
            </div>

            <hr className="border-t border-border" />

            <Tabs
              value={actionTab}
              onValueChange={(v) => setActionTab(v as typeof actionTab)}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Select
                  value={agent}
                  onValueChange={(value) => setAgent(value as AgentId)}
                >
                  <SelectTrigger className="w-full sm:w-auto sm:min-w-[200px] max-w-full">
                    <SelectValue placeholder="Select agent format" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        <span className="flex items-center gap-2">
                          {opt.name}
                          <Badge
                            variant="secondary"
                            className="text-xs font-mono"
                          >
                            {opt.path}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <TabsList className="flex flex-wrap gap-2 rounded-xl bg-muted/70 border border-border p-1.5 shadow-sm sm:ml-auto sm:justify-end">
                  {[{ id: "share", label: "Share Link" }]
                    .concat(
                      canExport
                        ? [
                            { id: "global", label: "Global Install" },
                            { id: "temp", label: "Temp Install" },
                            { id: "source", label: "Add Source" },
                          ]
                        : [],
                    )
                    .map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="font-semibold rounded-lg px-4 py-2 text-sm"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                </TabsList>
              </div>

              <div className="pt-4 space-y-4">
                <TabsContent value="share" className="space-y-3">
                  <p className="text-muted-foreground">
                    Make it easy for others to use these rules. Copy this link
                    to share.
                  </p>
                  <CommandBlock
                    code={shareText}
                    copyLabel="Copy"
                    variant="terminal"
                    promptSymbol=">"
                    showPrompt
                  />
                </TabsContent>

                {canExport && (
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
                    <CommandBlock
                      code={`${commands.globalInstall}\n${commands.globalInit}`}
                      copyLabel="Copy"
                    />
                  </TabsContent>
                )}

                {canExport && (
                  <TabsContent value="temp" className="space-y-3">
                    <p className="text-muted-foreground">
                      Quick one-off install. No global install required.
                    </p>
                    <CommandBlock
                      code={commands.tempInstall}
                      copyLabel="Copy"
                      onCopy={() => void postEvent(align.id, "install")}
                    />
                  </TabsContent>
                )}

                {canExport && (
                  <TabsContent value="source" className="space-y-3">
                    <p className="m-0 text-muted-foreground">
                      Already using AlignTrue? Add these rules as a connected
                      source.{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => setActionTab("global")}
                      >
                        New here? Use Global Install instead.
                      </Button>
                    </p>
                    <CommandBlock code={commands.addSource} copyLabel="Copy" />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {!previewText && (
          <p className="text-muted-foreground">
            Content unavailable. Try refreshing; the source may be temporarily
            unreachable.
          </p>
        )}
        {previewText && (
          <CodePreview
            filename={previewFilename}
            fileSelector={
              isPack && packFiles.length > 0 ? (
                <Select
                  value={selectedPath}
                  onValueChange={(value) => setSelectedPath(value)}
                >
                  <SelectTrigger className="w-full sm:w-auto sm:min-w-[220px] max-w-full border border-border bg-background">
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
              ) : undefined
            }
            content={converting ? "Converting..." : previewText}
            loading={converting}
            secondaryAction={downloadButton}
          />
        )}
      </div>
    </div>
  );
}
