"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { SiteHeader } from "@/app/components/SiteHeader";
import { SiteFooter } from "@/app/components/SiteFooter";
import {
  convertAlignContentForFormat,
  type TargetFormat,
} from "@/lib/aligns/format";
import { convertContent, type ConvertedContent } from "@/lib/aligns/convert";
import type { AlignRecord } from "@/lib/aligns/types";
import type { CachedContent, CachedPackFile } from "@/lib/aligns/content-cache";
import { buildPackZip, buildZipFilename } from "@/lib/aligns/zip-builder";

type Props = {
  align: AlignRecord;
  content: CachedContent | null;
};

type AgentId =
  | "all"
  | "cursor"
  | "claude"
  | "windsurf"
  | "copilot"
  | "gemini"
  | "zed"
  | "warp"
  | "cline"
  | "augmentcode"
  | "amazonq"
  | "openhands"
  | "kiro";

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
    <button
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
      style={{
        padding: variant === "primary" ? "0.85rem 1.3rem" : "0.65rem 1rem",
        background:
          variant === "primary"
            ? "var(--brand-accent, #F5A623)"
            : "var(--bg-default)",
        color: variant === "primary" ? "#fff" : "var(--fg-default)",
        border:
          variant === "primary" ? "none" : "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        cursor: "pointer",
        fontWeight: 600,
        boxShadow:
          variant === "primary"
            ? "0 4px 10px rgba(0,0,0,0.18)"
            : "0 1px 3px rgba(0,0,0,0.08)",
        minWidth: "120px",
      }}
    >
      {copied ? "✓ Copied" : (label ?? "Copy")}
    </button>
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
    if (convertedCache.get(cacheKey)) return;
    setConverting(true);
    try {
      const converted = convertContent(selectedContent, agent);
      setConvertedCache((prev) => {
        const next = new Map(prev);
        next.set(cacheKey, converted);
        return next;
      });
    } finally {
      setConverting(false);
    }
  }, [agent, cacheKey, convertedCache, selectedContent]);

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
    <div style={{ background: "var(--bg-default)", minHeight: "100vh" }}>
      <style jsx global>{`
        @media (max-width: 640px) {
          .align-detail-main {
            padding: 1rem !important;
          }
          .align-detail-header {
            padding: 1.25rem !important;
          }
          .align-detail-tabs button {
            padding: 0.5rem 0.75rem !important;
            font-size: 0.9rem !important;
          }
          .align-header-row {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 0.5rem !important;
          }
          .align-title-row {
            flex-direction: column;
            align-items: flex-start !important;
          }
          .align-title-right {
            width: 100%;
            align-items: flex-start !important;
          }
          .align-title-right select {
            width: 100%;
          }
          .align-tabs-wrap {
            overflow-x: auto;
            flex-wrap: nowrap !important;
          }
          .align-action-card {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .align-action-card code {
            width: 100%;
          }
          .align-download-card {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .align-download-card > span,
          .align-download-card > button {
            width: 100%;
            text-align: left;
          }
          .align-preview-header {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>
      <SiteHeader />
      <main
        className="align-detail-main"
        style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem" }}
      >
        <div
          className="align-detail-header"
          style={{
            background: "var(--bg-default)",
            border: "1px solid var(--border-color)",
            borderRadius: "1rem",
            padding: "1.75rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginTop: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            className="align-header-row"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
              color: "var(--fg-muted)",
              fontSize: "0.95rem",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
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
                style={{ color: "var(--fg-default)" }}
              >
                View on GitHub
              </a>
            </div>
            {isPack && (
              <a
                href="/docs/concepts/align-yaml-packs"
                style={{
                  color: "var(--fg-default)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  textDecoration: "none",
                }}
              >
                <HelpCircle size={16} />
                How .align.yaml files work
              </a>
            )}
          </div>
          <div
            style={{
              margin: "1rem 0 1.25rem",
              borderBottom: "1px solid var(--border-color)",
            }}
          />

          <div
            className="align-title-row"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginTop: "1rem",
            }}
          >
            <div style={{ minWidth: "240px", flex: "1 1 420px" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "baseline",
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: "2.1rem",
                    color: "var(--fg-default)",
                  }}
                >
                  {align.title || "Untitled align"}
                </h1>
                {isPack && align.pack && (
                  <span
                    style={{
                      color: "var(--fg-muted)",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                    }}
                  >
                    (.align.yaml) · {packFiles.length} files ·{" "}
                    {formatBytes(align.pack.totalBytes)}
                  </span>
                )}
              </div>
              {align.description && (
                <p
                  style={{
                    margin: "0.35rem 0 0",
                    color: "var(--fg-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {align.description}
                </p>
              )}
            </div>
            <div
              className="align-title-right"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "0.4rem",
                minWidth: "240px",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--fg-default)" }}>
                Agent export format
              </span>
              <select
                value={agent}
                onChange={(e) => setAgent(e.target.value as AgentId)}
                style={{
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.75rem",
                  background: "var(--bg-default)",
                  color: "var(--fg-default)",
                  fontWeight: 600,
                  minWidth: "240px",
                }}
              >
                {agentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "1rem",
            border: "1px solid var(--border-color)",
            borderRadius: "1rem",
            background: "var(--bg-default)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div
            className="align-detail-tabs align-tabs-wrap"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              borderBottom: "1px solid var(--border-color)",
              padding: "0.75rem 1rem 0 1rem",
            }}
          >
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
              <button
                key={tab.id}
                onClick={() => setActionTab(tab.id as typeof actionTab)}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: "0.75rem 0.75rem 0 0",
                  border: "1px solid var(--border-color)",
                  borderBottom:
                    actionTab === tab.id
                      ? "2px solid var(--fg-default)"
                      : "none",
                  background:
                    actionTab === tab.id
                      ? "var(--bg-default)"
                      : "var(--bg-muted)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ padding: "1rem 1.25rem" }}>
            {actionTab === "share" && (
              <>
                <p style={{ margin: "0 0 0.5rem", color: "var(--fg-muted)" }}>
                  Make it easy for others to use these rules. Copy this link to
                  share.
                </p>
                <div
                  className="align-action-card"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem",
                  }}
                >
                  <code
                    style={{
                      flex: "1 1 320px",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--bg-default)",
                      border: "1px solid var(--border-color)",
                      whiteSpace: "nowrap",
                      overflowX: "auto",
                    }}
                  >
                    {shareText}
                  </code>
                  <CopyButton text={shareText} label="Copy" variant="primary" />
                </div>
              </>
            )}

            {actionTab === "global" && (
              <>
                <p style={{ margin: "0 0 0.75rem", color: "var(--fg-muted)" }}>
                  New to AlignTrue? Install globally to manage rules across all
                  your projects. Copy and run both commands together.
                  <span style={{ marginLeft: "0.35rem" }}>
                    <a
                      href="/docs"
                      style={{ color: "var(--fg-default)", fontWeight: 600 }}
                    >
                      Learn more about AlignTrue
                    </a>
                  </span>
                </p>
                <div
                  className="align-action-card"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem",
                  }}
                >
                  <code
                    style={{
                      flex: "1 1 320px",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--bg-default)",
                      border: "1px solid var(--border-color)",
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                    }}
                  >
                    {`$ ${commands.globalInstall}\n$ ${commands.globalInit}`}
                  </code>
                  <CopyButton
                    text={`$ ${commands.globalInstall}\n$ ${commands.globalInit}`}
                    label="Copy"
                    variant="primary"
                  />
                </div>
              </>
            )}

            {actionTab === "temp" && (
              <div
                className="align-action-card"
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.75rem",
                  padding: "0.75rem",
                }}
              >
                <div style={{ flex: "1 1 320px" }}>
                  <p
                    style={{ margin: "0 0 0.35rem", color: "var(--fg-muted)" }}
                  >
                    Quick one-off install. No global install required.
                  </p>
                  <code
                    style={{
                      display: "block",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--bg-default)",
                      border: "1px solid var(--border-color)",
                      whiteSpace: "nowrap",
                      overflowX: "auto",
                      fontSize: "0.95rem",
                    }}
                  >
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
            )}

            {actionTab === "source" && (
              <div
                className="align-action-card"
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                  background: "var(--bg-muted)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.75rem",
                  padding: "0.75rem",
                }}
              >
                <div style={{ flex: "1 1 320px" }}>
                  <p
                    style={{ margin: "0 0 0.35rem", color: "var(--fg-muted)" }}
                  >
                    Already using AlignTrue? Add these rules as a connected
                    source.{" "}
                    <button
                      type="button"
                      onClick={() => setActionTab("global")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--fg-default)",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      New here? Use Global Install instead.
                    </button>
                  </p>
                  <code
                    style={{
                      display: "block",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--bg-default)",
                      border: "1px solid var(--border-color)",
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                      fontSize: "0.95rem",
                      lineHeight: 1.5,
                    }}
                  >
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
            )}

            {actionTab === "download" && !isPack && (
              <>
                <p style={{ margin: "0 0 0.5rem", color: "var(--fg-muted)" }}>
                  Copy the rules to your clipboard or download the file to add
                  manually.
                </p>
                <div
                  className="align-action-card"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      flex: "1 1 320px",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--bg-default)",
                      border: "1px solid var(--border-color)",
                      fontWeight: 600,
                      color: "var(--fg-default)",
                    }}
                  >
                    {format === "align-md" ? "Align (.md)" : "Cursor (.mdc)"}
                  </span>
                  <CopyButton
                    text={
                      cachedConverted?.text ||
                      (selectedContent
                        ? convertAlignContentForFormat(selectedContent, format)
                            .text
                        : "")
                    }
                    label="Copy"
                    variant="primary"
                  />
                  {selectedContent && (
                    <button
                      onClick={handleDownload}
                      style={{
                        padding: "0.85rem 1.3rem",
                        borderRadius: "0.75rem",
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-default)",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Download ({downloadFilename})
                    </button>
                  )}
                </div>
              </>
            )}
            {actionTab === "download" && isPack && align.pack && (
              <>
                <p style={{ margin: "0 0 0.5rem", color: "var(--fg-muted)" }}>
                  Download all rules as a zip to add them to your project.
                </p>
                <div
                  className="align-download-card"
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      flex: "1 1 320px",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--bg-default)",
                      border: "1px solid var(--border-color)",
                      fontWeight: 600,
                      color: "var(--fg-default)",
                    }}
                  >
                    {align.pack.manifestId} ({packFiles.length} rule files)
                  </span>
                  <button
                    onClick={handleDownloadAll}
                    style={{
                      padding: "0.85rem 1.3rem",
                      borderRadius: "0.75rem",
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-default)",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Download All (.zip)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: "1.5rem",
            border: "1px solid var(--border-color)",
            borderRadius: "1rem",
            padding: "1.25rem",
            background: "var(--bg-default)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div
            className="align-preview-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: "0 0 0.5rem" }}>Preview</h2>
            {isPack && packFiles.length > 0 && (
              <select
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                style={{
                  padding: "0.6rem 0.8rem",
                  borderRadius: "0.6rem",
                  border: "1px solid var(--border-color)",
                  minWidth: "260px",
                }}
              >
                {packFiles.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.path} ({formatBytes(file.size)})
                  </option>
                ))}
              </select>
            )}
          </div>
          {!previewText && (
            <p style={{ color: "var(--fg-muted)" }}>
              Content unavailable. Try refreshing; the source may be temporarily
              unreachable.
            </p>
          )}
          {previewText && (
            <pre
              style={{
                border: "1px solid var(--border-color)",
                borderRadius: "0.75rem",
                padding: "1rem",
                overflowX: "auto",
                background: "var(--bg-muted)",
                whiteSpace: "pre-wrap",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
              }}
            >
              {converting ? "Converting..." : previewText}
            </pre>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
