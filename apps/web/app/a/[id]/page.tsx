import { notFound } from "next/navigation";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  fetchRawWithCache,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { fetchPackForWeb } from "@/lib/aligns/pack-fetcher";
import { AlignDetailClient } from "./AlignDetailClient";
import { filenameFromUrl, parseGitHubUrl } from "@/lib/aligns/urlUtils";
import type { Metadata } from "next";

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
  if (align.kind === "pack" && align.pack) {
    content = await getCachedContent(align.id, async () => {
      const pack = await fetchPackForWeb(align.url);
      return { kind: "pack", files: pack.files };
    });
  } else {
    content = await fetchRawWithCache(align.id, align.normalizedUrl);
  }

  return <AlignDetailClient align={align} content={content} />;
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const align = await store.get(id);
  if (!align) return {};

  const { owner, repo } = parseGitHubUrl(align.normalizedUrl);
  const ownerSlug = owner?.startsWith("@") ? owner.slice(1) : owner;
  const ogImage =
    ownerSlug && repo
      ? `https://opengraph.githubassets.com/1/${ownerSlug}/${repo}`
      : undefined;

  const ruleTitle = align.title || "Align";
  const title = `${ruleTitle} by ${owner || "unknown"} - AlignTrue`;
  const description =
    align.description ||
    `${ruleTitle} (${filenameFromUrl(align.normalizedUrl || align.url)}) in any agent format, including AGENTS.md, Cursor, Claude Code, Copilot, Gemini and 20+ other agents.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
  };
}
