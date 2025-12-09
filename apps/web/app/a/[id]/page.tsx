import { notFound } from "next/navigation";
import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  fetchRawWithCache,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { fetchPackForWeb } from "@/lib/aligns/pack-fetcher";
import { AlignDetailClient } from "./AlignDetailClient";

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
