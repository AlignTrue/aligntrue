import { readFile } from "node:fs/promises";

import { ImageResponse } from "@vercel/og";
import sharp from "sharp";

import { AlignTrueLogoOG } from "@/app/api/og/AlignTrueLogoOG";
import { generateBarSegments, idToSeed } from "@/lib/aligns/hash-bar-utils";
import { parseGitHubUrl } from "@/lib/aligns/urlUtils";
import type { AlignRecord } from "@/lib/aligns/types";

const COLORS = {
  bg: "hsl(222 24% 6%)",
  card: "hsl(222 24% 8%)",
  border: "hsl(220 16% 20%)",
  foreground: "hsl(210 30% 96%)",
  muted: "hsl(215 15% 70%)",
  primary: "hsl(160 84% 45%)",
  accent: "#F5A623",
};

const KINDS: Record<string, string> = {
  rule: "AI Rule",
  rule_group: "AI Rules",
  skill: "AI Skill",
  mcp: "MCP",
  pack: "AI Rule Pack",
  other: "AI Context",
};

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const FALLBACK_DESCRIPTION = "Try these rules to guide your AI";
const COMMAND_PREFIX = "npx aligntrue init a:";
const SOURCE_LABEL = "GitHub";

// The font path is static and not influenced by user input; lint rule is a false positive here.
const fontPromise =
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  readFile(new URL("../../public/fonts/NotoSans-Regular.ttf", import.meta.url));

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildDescription(
  title: string,
  rawDescription?: string | null,
): string {
  const raw = rawDescription ? truncate(rawDescription, 180) : "";
  if (!raw) return "";
  return raw.toLowerCase().trim() === title.toLowerCase().trim()
    ? FALLBACK_DESCRIPTION
    : raw;
}

export function buildInstallCommand(id: string): string {
  return `${COMMAND_PREFIX}${id}`;
}

export async function buildOgImageResponse(options: {
  align: AlignRecord;
  id: string;
  headers?: Record<string, string>;
}) {
  const { align, id, headers } = options;
  const { owner } = parseGitHubUrl(align.normalizedUrl);
  const title = align.title || "Untitled Align";
  const description = buildDescription(title, align.description);
  const kindLabel = KINDS[align.kind] ?? "Align";
  const installCommand = buildInstallCommand(id);
  const fontData = await fontPromise;

  return new ImageResponse(
    (
      <div
        style={{
          width: `${OG_WIDTH}px`,
          height: `${OG_HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
          padding: "56px",
          paddingBottom: "80px",
          background: `linear-gradient(145deg, ${COLORS.card}, #0f131d)`,
          color: COLORS.foreground,
          position: "relative",
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
              fontWeight: 700,
              fontSize: "22px",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {kindLabel}
          </div>
          <AlignTrueLogoOG
            width={180}
            color="rgba(240,244,248,0.85)"
            accent={COLORS.accent}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginTop: "24px",
          }}
        >
          <div
            style={{
              fontSize: "60px",
              lineHeight: 1.05,
              fontWeight: 800,
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "24px",
                color: COLORS.muted,
                fontWeight: 600,
              }}
            >
              <span>by</span>
              <span style={{ color: COLORS.foreground }}>{owner}</span>
              <span>via</span>
              <span style={{ color: COLORS.foreground }}>{SOURCE_LABEL}</span>
            </div>
          </div>

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
                background: "rgba(15, 19, 29, 0.8)",
                border: `1px solid ${COLORS.border}`,
                boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                fontFamily: "monospace",
                fontSize: "26px",
                color: COLORS.foreground,
                letterSpacing: "0.01em",
              }}
            >
              <span style={{ color: COLORS.muted }}>$</span>
              <span>{installCommand}</span>
            </div>
            <div style={{ height: "8px" }} />
            <div
              style={{
                fontSize: "18px",
                color: COLORS.muted,
                textAlign: "right",
                maxWidth: "460px",
                lineHeight: 1.4,
              }}
            >
              Use with any AI agent (Cursor, Claude, Codex, etc.).
            </div>
          </div>
        </div>
        {/* Hash-derived color bar footer */}
        <div
          style={{
            display: "flex",
            height: "16px",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
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
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        {
          name: "Noto Sans",
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
  align: AlignRecord;
  id: string;
}): Promise<Buffer> {
  const response = await buildOgImageResponse(options);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateOgImage(options: {
  align: AlignRecord;
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
