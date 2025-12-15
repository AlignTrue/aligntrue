import crypto from "node:crypto";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  fetchRawWithCache,
  setCachedContent,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { fetchPackForWeb } from "@/lib/aligns/pack-fetcher";
import { AlignDetailClient } from "./AlignDetailClient";
import { filenameFromUrl } from "@/lib/aligns/urlUtils";
import { getOgUrlForAlign } from "@/lib/og/storage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";
const FAILURE_THRESHOLD = 3;

export const dynamic = "force-dynamic";

const store = getAlignStore();

function hashString(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function hashContent(content: CachedContent | null): string | null {
  if (!content) return null;
  if (content.kind === "single") {
    return hashString(content.content);
  }
  const ordered = [...content.files].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const payload = JSON.stringify(
    ordered.map((file) => ({ path: file.path, content: file.content })),
  );
  return hashString(payload);
}

export default async function AlignDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const align = await store.get(id);
  if (!align) {
    notFound();
  }

  let content: CachedContent | null = null;
  let fetchFailed = false;
  let alignForRender = align;

  if (align.kind === "pack" && align.pack) {
    const isCatalogPack = align.source === "catalog";
    const packUrl = align.normalizedUrl || align.url;
    try {
      if (isCatalogPack && align.containsAlignIds?.length) {
        const ruleIds = align.containsAlignIds;
        const rules = await store.getMultiple(ruleIds);
        const filesResult = await Promise.all(
          rules.filter(Boolean).map(async (rule) => {
            try {
              const ruleContent = await fetchRawWithCache(
                rule!.id,
                rule!.normalizedUrl || rule!.url,
                256 * 1024,
              );
              if (ruleContent?.kind !== "single") return null;
              const text = ruleContent.content;
              return {
                path: filenameFromUrl(rule!.normalizedUrl || rule!.url),
                size: new TextEncoder().encode(text).length,
                content: text,
              };
            } catch (err) {
              console.error("failed to fetch rule content", err);
              return null;
            }
          }),
        );
        const files = filesResult.filter(Boolean) as {
          path: string;
          size: number;
          content: string;
        }[];

        content = { kind: "pack", files };
        await setCachedContent(align.id, content);
      } else {
        const shouldRefresh =
          align.sourceRemoved ||
          (align.fetchFailCount ?? 0) >= FAILURE_THRESHOLD;
        if (shouldRefresh) {
          const pack = await fetchPackForWeb(packUrl);
          content = { kind: "pack", files: pack.files };
          await setCachedContent(align.id, content);
        } else {
          content = await getCachedContent(align.id, async () => {
            const pack = await fetchPackForWeb(packUrl);
            return { kind: "pack", files: pack.files };
          });
        }
      }
    } catch (error) {
      if (content) {
        // Cache write failed; keep the fresh content instead of discarding it.
        console.error("failed to cache pack content", error);
      } else {
        fetchFailed = true;
        console.error("failed to fetch pack content", error);
        content = await getCachedContent(align.id);
        if (!content) {
          console.error("no cached pack content available after failure");
        }
      }
    }
  } else {
    const rawUrl = align.normalizedUrl || align.url;
    const shouldRefresh =
      align.sourceRemoved || (align.fetchFailCount ?? 0) >= FAILURE_THRESHOLD;
    try {
      content = await fetchRawWithCache(align.id, rawUrl, 256 * 1024, {
        forceRefresh: shouldRefresh,
      });
    } catch (error) {
      fetchFailed = true;
      console.error("failed to fetch raw content", error);
      content = await getCachedContent(align.id);
      if (!content) {
        console.error("no cached raw content available after failure");
      }
    }
  }

  if (fetchFailed) {
    const now = new Date().toISOString();
    await store.markSourceRemoved(align.id, now);
    const updated = await store.get(align.id);
    alignForRender = updated ?? {
      ...align,
      sourceRemoved: true,
      sourceRemovedAt: now,
      fetchFailCount: (align.fetchFailCount ?? 0) + 1,
    };
  } else if (align.sourceRemoved || (align.fetchFailCount ?? 0) > 0) {
    await store.resetSourceRemoved(align.id);
    const updated = await store.get(align.id);
    alignForRender = updated ?? align;
  }

  const currentHash = hashContent(content);
  const contentHashMismatch =
    !!alignForRender.contentHash &&
    !!currentHash &&
    alignForRender.contentHash !== currentHash;

  const enrichedAlign = {
    ...alignForRender,
    ...(currentHash && !alignForRender.contentHash
      ? {
          contentHash: currentHash,
          contentHashUpdatedAt: new Date().toISOString(),
        }
      : {}),
    ...(contentHashMismatch ? { contentHashMismatch: true } : {}),
  };

  return <AlignDetailClient align={enrichedAlign} content={content} />;
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const align = await store.get(id);
  if (!align) return {};

  const ruleTitle = align.title || "Align";
  const title = `${ruleTitle} - AlignTrue`;
  const description =
    align.description ||
    `${ruleTitle} (${filenameFromUrl(align.normalizedUrl || align.url)}) in any agent format, including AGENTS.md, Cursor, Claude Code, Copilot, Gemini and 20+ other agents.`;

  const ogImage = (await getOgUrlForAlign(id)) ?? `${BASE_URL}/api/og/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/a/${id}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/a/${id}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${ruleTitle} - AlignTrue`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
