"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HashBar } from "@/components/HashBar";
import { CommunityContentNotice } from "@/components/CommunityContentNotice";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { AlignRecord } from "@/lib/aligns/types";
import type { CachedContent, CachedPackFile } from "@/lib/aligns/content-cache";
import { filenameFromUrl } from "@/lib/aligns/urlUtils";
import { cn, formatBytes } from "@/lib/utils";
import { PackMembershipBadges } from "./PackMembershipBadges";
import { toAlignSummary } from "@/lib/aligns/transforms";
import { isCatalogPack } from "@/lib/aligns/pack-helpers";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import { Link2 } from "lucide-react";
import {
  extractRuleSettings,
  stripFrontmatter,
} from "@/lib/aligns/rule-settings";
import { RuleSettingsCard } from "./RuleSettingsCard";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";

const EMPTY_PACK_FILES: CachedPackFile[] = [];

export type AlignDetailPreviewProps = {
  align: AlignRecord;
  content: CachedContent | null;
  className?: string;
};

type ActionTabConfig = {
  id: InstallTabId;
  label: string;
  commands: CommandGroup[];
  trackInstall?: boolean;
};

type InstallTabId = "new" | "existing";

type CommandGroup = {
  description: string;
  command: string;
};

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
  const { copied: shareCopied, copy: copyShare } = useCopyToClipboard();
  const isArchived = align.sourceRemoved === true;
  const [installTab, setInstallTab] = useState<InstallTabId>("new");
  const isPack =
    align.kind === "pack" &&
    content?.kind === "pack" &&
    Array.isArray(content.files) &&
    !!align.pack;
  const packFiles = isPack ? content.files : EMPTY_PACK_FILES;
  const [selectedPath, setSelectedPath] = useState<string>(
    isPack ? (packFiles[0]?.path ?? "") : "single",
  );
  const [related, setRelated] = useState<{
    packs: AlignRecord[];
    rules: AlignRecord[];
  } | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const catalogPack = isCatalogPack(align);
  const alignSharePath = `/a/${align.id}`;
  const shareUrl = `${BASE_URL}${alignSharePath}`;
  const display = useMemo(() => toAlignSummary(align), [align]);

  useEffect(() => {
    void postEvent(align.id, "view");
  }, [align.id]);

  useEffect(() => {
    setRelatedLoading(true);
    fetch(`/api/aligns/${align.id}/related`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRelated({ packs: data.packs ?? [], rules: data.rules ?? [] });
        }
      })
      .catch(() => {})
      .finally(() => setRelatedLoading(false));
  }, [align.id]);

  useEffect(() => {
    if (isPack) {
      setSelectedPath(packFiles[0]?.path ?? "");
    } else {
      setSelectedPath("single");
    }
  }, [isPack, packFiles]);

  const owner = display.displayAuthor;
  const ownerUrl = display.displayAuthorUrl;
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

  const singleFilename = useMemo(() => {
    if (isPack) return null;
    const fromUrl = filenameFromUrl(align.normalizedUrl || align.url);
    return fromUrl || "rules.md";
  }, [align.normalizedUrl, align.url, isPack]);

  const fileNameLabel = useMemo(() => {
    if (catalogPack) return "Align Pack";
    if (isPack) return display.displayFilename ?? "Pack";
    return (
      display.displayFilename ??
      filenameFromUrl(align.normalizedUrl || align.url)
    );
  }, [
    align.normalizedUrl,
    align.url,
    display.displayFilename,
    isPack,
    catalogPack,
  ]);

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

  const installTabs = useMemo((): ActionTabConfig[] => {
    const installTarget = align.url || shareUrl || align.id;
    const linkTarget = catalogPack ? align.id : installTarget;
    const addCommandExisting = `aligntrue add ${catalogPack ? align.id : installTarget}`;
    const linkCommandExisting = `aligntrue add link ${linkTarget}`;
    const installCommand = `npm install -g aligntrue\naligntrue init ${
      catalogPack ? align.id : installTarget
    }`;
    const oneOffCommand = `npx aligntrue init ${catalogPack ? align.id : installTarget}`;

    return [
      {
        id: "new",
        label: "New to AlignTrue",
        commands: [
          {
            description: "Install globally",
            command: installCommand,
          },
          {
            description: "One-off (no install)",
            command: oneOffCommand,
          },
        ],
        trackInstall: true,
      },
      {
        id: "existing",
        label: "Existing users",
        commands: [
          {
            description: "Add to project",
            command: addCommandExisting,
          },
          {
            description: "Link for updates",
            command: linkCommandExisting,
          },
        ],
        trackInstall: true,
      },
    ];
  }, [align.id, align.url, catalogPack, shareUrl]);

  const previewText = selectedContent
    ? stripFrontmatter(selectedContent)
    : "Content unavailable.";

  const previewFilename = isPack
    ? selectedPath || "rules.md"
    : singleFilename || "rules.md";

  const ruleSettings = useMemo(
    () => extractRuleSettings(selectedContent || ""),
    [selectedContent],
  );

  const relatedPacks = related?.packs ?? [];
  const relatedRules = related?.rules ?? [];

  return (
    <div className={cn("space-y-6", className)}>
      <Card variant="surface">
        <CardContent className="p-6 space-y-5">
          <HashBar
            id={align.id}
            height={4}
            className="-mx-6 -mt-6 rounded-t-xl mb-4"
          />
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold text-foreground m-0 leading-tight">
                    {align.title || "Untitled align"}
                  </h1>
                  {isArchived && (
                    <Badge variant="secondary" className="text-xs">
                      Archived copy (source removed)
                    </Badge>
                  )}
                  {align.contentHashMismatch && (
                    <Badge variant="destructive" className="text-xs">
                      Content changed since submission
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed m-0">
                  {align.description ||
                    `Use this AI ${align.kind || "rule"} in any agent format, including AGENTS.md, CLAUDE.md, Cursor, Copilot, Gemini and 20+ others.`}
                </p>
                {(isPack || relatedPacks.length > 0) && (
                  <div className="mt-auto space-y-2 pt-2">
                    {!isPack && relatedPacks.length > 0 && (
                      <PackMembershipBadges packs={relatedPacks} />
                    )}
                    {isPack && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground mb-2">
                          Includes:{relatedLoading ? " (loading...)" : ""}
                        </p>
                        {relatedRules.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {relatedRules.map((rule) => (
                              <Badge
                                key={rule.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                <a
                                  href={`/a/${rule.id}`}
                                  className="hover:underline"
                                >
                                  {rule.title || rule.id}
                                </a>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          !relatedLoading && (
                            <p className="text-sm text-muted-foreground m-0">
                              No linked aligns yet.
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2.5 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <div className="flex items-center gap-2">
                    {isArchived || catalogPack || !display.externalUrl ? (
                      <span className="font-semibold text-foreground">
                        {fileNameLabel}
                      </span>
                    ) : (
                      <a
                        href={display.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-foreground hover:underline"
                      >
                        {fileNameLabel}
                      </a>
                    )}
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
                  {owner ? (
                    <>
                      <span className="text-xs text-muted-foreground">by</span>
                      {ownerUrl && !isArchived ? (
                        <a
                          href={ownerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-foreground hover:underline"
                        >
                          {owner}
                        </a>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {owner}
                        </span>
                      )}
                    </>
                  ) : null}
                  {(fileCountLabel || sizeLabel) && (
                    <Badge variant="outline" className="font-semibold">
                      {fileCountLabel}
                      {fileCountLabel && sizeLabel ? " · " : ""}
                      {sizeLabel}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-2.5 space-y-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2
                      size={16}
                      className="text-accent shrink-0"
                      aria-hidden
                    />
                    <span className="text-sm font-medium text-foreground font-mono truncate">
                      {shareUrl.replace("https://", "")}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-center border-accent/50 text-accent hover:bg-accent/10 hover:text-accent"
                    onClick={() => void copyShare(shareUrl)}
                  >
                    {shareCopied ? "Copied!" : "Copy Share Link"}
                  </Button>
                </div>
              </div>
            </div>

            <hr className="border-t border-border my-6" />
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                {installTab === "new" && installTabs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Customize your agent preferences during setup. AlignTrue
                      will configure exports automatically.
                    </p>
                  </div>
                )}

                {installTabs.length > 0 ? (
                  <Tabs
                    value={installTab}
                    onValueChange={(v) => setInstallTab(v as InstallTabId)}
                    className="sm:ml-auto"
                  >
                    <TabsList className="flex flex-wrap gap-2 rounded-xl bg-muted/70 border border-border p-1.5 shadow-sm justify-center">
                      {installTabs.map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className="font-semibold rounded-lg px-4 py-2 text-sm"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                ) : null}
              </div>

              {installTabs.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-foreground m-0 mb-2">
                    {installTab === "new" ? "Install via CLI" : "Add via CLI"}
                  </h3>
                  {(() => {
                    const currentTab = installTabs.find(
                      (t) => t.id === installTab,
                    );
                    if (!currentTab) return null;

                    return (
                      <div className="space-y-4">
                        {currentTab.commands.map((group) => (
                          <CommandBlock
                            key={group.description}
                            code={group.command}
                            description={group.description}
                            copyLabel="Copy"
                            onCopy={
                              currentTab.trackInstall
                                ? () => void postEvent(align.id, "install")
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <RuleSettingsCard settings={ruleSettings} />

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
              <div className="flex items-center gap-3">
                {isPack && packFiles.length > 0 ? (
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
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {previewFilename}
                  </span>
                )}
                <CommunityContentNotice
                  alignId={align.id}
                  alignUrl={align.normalizedUrl || align.url}
                  compact
                  variant="inline"
                />
              </div>
            }
            content={previewText}
          />
        )}
      </div>
    </div>
  );
}
