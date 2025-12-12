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
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aligntrue.ai";
const FAILURE_THRESHOLD = 3;

export const dynamic = "force-dynamic";

const store = getAlignStore();

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
    const packUrl = align.normalizedUrl || align.url;
    try {
      const shouldRefresh =
        align.sourceRemoved || (align.fetchFailCount ?? 0) >= FAILURE_THRESHOLD;
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
      if (!content) {
        fetchFailed = true;
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
    const shouldRefresh =
      align.sourceRemoved || (align.fetchFailCount ?? 0) >= FAILURE_THRESHOLD;
    try {
      content = await fetchRawWithCache(
        align.id,
        align.normalizedUrl,
        256 * 1024,
        { forceRefresh: shouldRefresh },
      );
      if (!content) {
        fetchFailed = true;
      }
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
    alignForRender = {
      ...align,
      sourceRemoved: false,
      sourceRemovedAt: undefined,
      fetchFailCount: 0,
    };
  }

  return <AlignDetailClient align={alignForRender} content={content} />;
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

  const ogImage = `${BASE_URL}/api/og/${id}`;

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
          alt: "AlignTrue catalog item",
        },
      ],
    },
  };
}
