import { readFile } from "node:fs/promises";

import { ImageResponse } from "@vercel/og";
import { AlignTrueLogoOG } from "../AlignTrueLogoOG";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import { parseGitHubUrl } from "@/lib/aligns/urlUtils";

export const runtime = "nodejs";

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
  rule: "Rule",
  rule_group: "Rule group",
  skill: "Skill",
  mcp: "MCP",
  pack: "Align pack",
  other: "Align",
};

const store = getAlignStore();
// The font path is static and not influenced by user input; lint rule is a false positive here.
const fontPromise =
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  readFile(
    new URL("../../../../public/fonts/NotoSans-Regular.ttf", import.meta.url),
  );
const FALLBACK_DESCRIPTION = "Try these rules to guide your AI";
const COMMAND_PREFIX = "npx aligntrue init a:";
const SOURCE_LABEL = "GitHub";
const PATTERNS = [
  { angle: 45, accent: "rgba(20,184,122,0.15)", pos: "20% 30%" },
  { angle: 60, accent: "rgba(82,146,255,0.12)", pos: "75% 25%" },
  { angle: 75, accent: "rgba(168,85,247,0.12)", pos: "30% 70%" },
  { angle: 120, accent: "rgba(251,191,36,0.1)", pos: "80% 60%" },
  { angle: 135, accent: "rgba(59,130,246,0.14)", pos: "15% 80%" },
];
// Brand-aligned palette for the footer bar
const BAR_COLORS = [
  "hsl(160 84% 45%)", // primary green
  "hsl(210 90% 60%)", // accent blue
  "#F5A623", // orange accent
  "hsl(160 84% 35%)", // darker green
  "hsl(210 90% 50%)", // deeper blue
  "hsl(45 93% 55%)", // warm yellow/gold
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function idToSeed(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function generateBarSegments(seed: number, count = 5) {
  const segments: { color: string; flex: number }[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = ((s * 1103515245 + 12345) >>> 0) % 2147483648;
    const color = BAR_COLORS[s % BAR_COLORS.length];
    const flex = 1 + (s % 8); // width weight 1-8
    segments.push({ color, flex });
  }
  return segments;
}

export function buildDescription(
  title: string,
  rawDescription?: string,
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const align = await store.get(id);

  if (!align) {
    return new Response("Not found", { status: 404 });
  }

  const { owner } = parseGitHubUrl(align.normalizedUrl);
  const title = align.title || "Untitled Align";
  const description = buildDescription(title, align.description);
  const kindLabel = KINDS[align.kind] ?? "Align";
  const installCommand = buildInstallCommand(id);

  const pattern = PATTERNS[idToSeed(id) % PATTERNS.length];

  const backgroundImage = `
    radial-gradient(circle at ${pattern.pos}, ${pattern.accent}, transparent 45%),
    radial-gradient(circle at 78% 24%, rgba(82,146,255,0.08), transparent 40%),
    linear-gradient(${pattern.angle}deg, rgba(255,255,255,0.04) 1px, transparent 1px)
  `;
  const backgroundSize = "100% 100%, 100% 100%, 24px 24px";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.bg,
          backgroundImage,
          backgroundSize, // size controls spacing of the line grid
          padding: "48px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            gap: "32px",
            padding: "56px",
            background: `linear-gradient(145deg, ${COLORS.card}, #0f131d)`,
            color: COLORS.foreground,
            borderRadius: "28px",
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 24px 72px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <AlignTrueLogoOG
                width={180}
                color="rgba(240,244,248,0.85)"
                accent={COLORS.accent}
              />
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
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
                  fontSize: "28px",
                  lineHeight: 1.4,
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
                  fontSize: "22px",
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
                  fontSize: "22px",
                  color: COLORS.foreground,
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ color: COLORS.muted }}>$</span>
                <span>{installCommand}</span>
              </div>
            </div>
          </div>
          {/* Hash-derived color bar footer */}
          <div
            style={{
              display: "flex",
              height: "16px",
              marginTop: "auto",
              marginLeft: "-56px",
              marginRight: "-56px",
              marginBottom: "-56px",
              borderRadius: "0 0 28px 28px",
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
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Noto Sans",
          data: await fontPromise,
          weight: 400,
          style: "normal",
        },
      ],
      headers: {
        // Shorter cache to avoid stale OG data after align updates
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    },
  );
}
