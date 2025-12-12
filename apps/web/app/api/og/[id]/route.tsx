import { ImageResponse } from "@vercel/og";
import { AlignTrueLogoOG } from "../AlignTrueLogoOG";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import { parseGitHubUrl } from "@/lib/aligns/urlUtils";

export const runtime = "edge";

const FONT_SANS = fetch(
  "https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA.woff2",
).then((res) => res.arrayBuffer());

const FONT_MONO = fetch(
  "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.woff2",
).then((res) => res.arrayBuffer());

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const align = await store.get(id);

  if (!align) {
    return new Response("Not found", { status: 404 });
  }

  const { owner } = parseGitHubUrl(align.normalizedUrl);
  const title = align.title || "Untitled Align";
  const description = align.description ? truncate(align.description, 180) : "";
  const kindLabel = KINDS[align.kind] ?? "Align";

  const [fontSans, fontMono] = await Promise.all([FONT_SANS, FONT_MONO]);

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
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(20,184,122,0.18), transparent 40%), radial-gradient(circle at 78% 24%, rgba(82,146,255,0.12), transparent 46%)",
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
            fontFamily: "Plus Jakarta Sans",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div
              style={{
                display: "inline-flex",
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
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  fontFamily: "JetBrains Mono",
                  fontSize: "20px",
                  color: COLORS.foreground,
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span style={{ color: COLORS.muted }}>ID:</span>
                <span>{align.id}</span>
              </div>
            </div>

            <AlignTrueLogoOG
              width={180}
              color="rgba(240,244,248,0.75)"
              accent={COLORS.accent}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Plus Jakarta Sans",
          data: fontSans,
          weight: 400,
          style: "normal",
        },
        {
          name: "JetBrains Mono",
          data: fontMono,
          weight: 500,
          style: "normal",
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
