"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  convertAlignContentForFormat,
  type TargetFormat,
} from "@/lib/aligns/format";
import type { AlignRecord } from "@/lib/aligns/types";

type Props = {
  align: AlignRecord;
  content: string | null;
};

async function postEvent(id: string, type: "view" | "install") {
  await fetch(`/api/aligns/${id}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}

export function AlignDetailClient({ align, content }: Props) {
  const [format, setFormat] = useState<TargetFormat>("align-md");

  useEffect(() => {
    void postEvent(align.id, "view");
  }, [align.id]);

  const installCommand = useMemo(
    () => `npm install -g aligntrue\naligntrue init --source ${align.url}`,
    [align.url],
  );

  const handleCopyInstall = async () => {
    await navigator.clipboard.writeText(installCommand);
    void postEvent(align.id, "install");
  };

  const handleCopyContent = async () => {
    if (!content) return;
    const converted = convertAlignContentForFormat(content, format);
    await navigator.clipboard.writeText(converted.text);
  };

  const handleDownload = () => {
    if (!content) return;
    const converted = convertAlignContentForFormat(content, format);
    const blob = new Blob([converted.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = converted.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{ maxWidth: "960px", margin: "2rem auto", padding: "0 1.5rem" }}
    >
      <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
        Align ID: {align.id} · Provider: {align.provider}
      </p>
      <h1 style={{ marginBottom: "0.25rem" }}>
        {align.title || "Untitled align"}
      </h1>
      <p style={{ color: "#4b5563", marginBottom: "0.5rem" }}>
        {align.description}
      </p>
      <a href={align.normalizedUrl} target="_blank" rel="noreferrer">
        View on GitHub
      </a>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "1rem",
          alignItems: "center",
        }}
      >
        <label>
          Download as{" "}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as TargetFormat)}
          >
            <option value="align-md">Align (.md)</option>
            <option value="cursor-mdc">Cursor (.mdc)</option>
          </select>
        </label>
        <button onClick={handleDownload}>Download file</button>
        <button onClick={handleCopyContent}>Copy text</button>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "1rem",
          marginTop: "1.5rem",
          background: "#f9fafb",
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
          Install with AlignTrue
        </p>
        <pre
          style={{
            background: "#111827",
            color: "#e5e7eb",
            padding: "0.75rem",
            borderRadius: "6px",
            overflowX: "auto",
            margin: "0 0 0.5rem 0",
          }}
        >
          {installCommand}
        </pre>
        <button onClick={handleCopyInstall}>Copy command</button>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2>Content</h2>
        {!content && (
          <p style={{ color: "#6b7280" }}>
            Content unavailable. Try refreshing; the source may be temporarily
            unreachable.
          </p>
        )}
        {content && align.fileType === "markdown" && (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
        {content && align.fileType !== "markdown" && (
          <pre
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "1rem",
              overflowX: "auto",
              background: "#f9fafb",
            }}
          >
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
