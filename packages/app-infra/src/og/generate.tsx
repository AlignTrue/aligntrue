import React from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";

import { generateBarSegments, idToSeed } from "./hash-bar.js";

const COLORS = {
  card: "hsl(222 24% 8%)",
  foreground: "hsl(210 30% 96%)",
  muted: "hsl(215 15% 70%)",
  primary: "hsl(160 84% 45%)",
  accent: "#F5A623",
};

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const FALLBACK_DESCRIPTION = "Deterministic AI receipts preview";

// Google Fonts CDN - Inter Regular (400 weight)
const INTER_FONT_URL =
  "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf";

let fontCache: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;

  const res = await fetch(INTER_FONT_URL);
  if (!res.ok) {
    throw new Error(`Font load failed: ${res.status} ${res.statusText}`);
  }
  fontCache = await res.arrayBuffer();
  return fontCache;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface OgContent {
  title: string;
  description?: string | null;
  /**
   * Short badge shown in the top-left pill.
   */
  badge?: string;
  /**
   * Optional label rendered near the logo.
   */
  kindLabel?: string;
  /**
   * Optional author or attribution line.
   */
  author?: string;
  /**
   * Source label shown under the author (e.g., GitHub).
   */
  sourceLabel?: string;
  /**
   * Command or primary call-to-action displayed on the right.
   */
  command?: string;
  /**
   * Optional footer lines displayed under the command.
   */
  footerLines?: string[];
}

function buildDescription(
  title: string,
  rawDescription?: string | null,
): string {
  const raw = rawDescription ? truncate(rawDescription, 180) : "";
  if (!raw) return "";
  return raw.toLowerCase().trim() === title.toLowerCase().trim()
    ? FALLBACK_DESCRIPTION
    : raw;
}

function defaultFooterLines(content: OgContent): string[] {
  if (content.footerLines && content.footerLines.length > 0) {
    return content.footerLines;
  }
  return ["shareable · deterministic · auditable"];
}

export async function buildOgImageResponse(options: {
  content: OgContent;
  id: string;
  headers?: Record<string, string>;
}) {
  const { content, id, headers } = options;
  const title = truncate(content.title, 60);
  const description = buildDescription(content.title, content.description);
  const badge = content.badge ?? "Preview";
  const kindLabel = content.kindLabel ?? "AlignTrue";
  const author = content.author;
  const sourceLabel = content.sourceLabel ?? "GitHub";
  const command = content.command;
  const footerLines = defaultFooterLines(content);
  const fontData = await getFont();

  return new ImageResponse(
    <div
      style={{
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(145deg, ${COLORS.card}, #0f131d)`,
        color: COLORS.foreground,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding: "56px",
          gap: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 18px",
              borderRadius: "999px",
              border: `1px solid rgba(20,184,122,0.35)`,
              background: "rgba(20,184,122,0.12)",
              color: COLORS.primary,
              fontWeight: 600,
              fontSize: "22px",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {badge}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "rgba(240,244,248,0.85)",
              fontWeight: 700,
              fontSize: "24px",
              letterSpacing: "0.02em",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: COLORS.accent,
                boxShadow: "0 0 12px rgba(245,166,35,0.6)",
              }}
            />
            <div>{kindLabel}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              fontSize: "60px",
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              maxWidth: "1000px",
            }}
          >
            {title}
          </div>
          {description ? (
            <div
              style={{
                fontSize: "32px",
                lineHeight: 1.45,
                color: COLORS.muted,
                maxWidth: "980px",
              }}
            >
              {description}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {(author || sourceLabel) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "24px",
                  color: COLORS.muted,
                  fontWeight: 600,
                }}
              >
                {author && <div>by</div>}
                {author && (
                  <div style={{ color: COLORS.foreground }}>{author}</div>
                )}
                {sourceLabel && <div>via</div>}
                {sourceLabel && (
                  <div style={{ color: COLORS.foreground }}>{sourceLabel}</div>
                )}
              </div>
            )}
          </div>

          {command ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(15, 19, 29, 0.85)",
                  border: "2px solid rgba(20,184,122,0.55)",
                  boxShadow:
                    "0 12px 28px rgba(0,0,0,0.38), 0 0 0 1px rgba(20,184,122,0.2)",
                  fontFamily: "monospace",
                  fontSize: "26px",
                  color: COLORS.foreground,
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ color: COLORS.muted }}>$</span>
                <span>{command}</span>
              </div>
              <div style={{ height: "8px" }} />
              {footerLines.length > 0 ? (
                <div
                  style={{
                    fontSize: "18px",
                    color: COLORS.muted,
                    textAlign: "right",
                    maxWidth: "460px",
                    lineHeight: 1.4,
                  }}
                >
                  {footerLines.join(" · ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {/* Hash-derived color bar footer */}
      <div
        style={{
          display: "flex",
          height: "16px",
          width: "100%",
          overflow: "hidden",
        }}
      >
        {generateBarSegments(idToSeed(id)).map((seg, i) => (
          <div
            key={i}
            style={{
              flex: seg.flex,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>
    </div>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
      ...(headers ? { headers } : {}),
    },
  );
}

export async function renderOgPng(options: {
  content: OgContent;
  id: string;
}): Promise<Buffer> {
  const response = await buildOgImageResponse(options);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateOgImage(options: {
  content: OgContent;
  id: string;
}): Promise<Buffer> {
  const pngBuffer = await renderOgPng(options);
  const jpegBuffer = await sharp(pngBuffer)
    .jpeg({
      quality: 88,
      chromaSubsampling: "4:4:4",
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();
  return jpegBuffer;
}
