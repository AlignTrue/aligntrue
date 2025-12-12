import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  fetchRawWithCache,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { fetchPackForWeb } from "@/lib/aligns/pack-fetcher";
import { findSeedContent } from "@/lib/aligns/seedData";

export const dynamic = "force-dynamic";

const store = getAlignStore();

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const align = await store.get(id);
  if (!align) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const seedContent = findSeedContent(id);
  if (seedContent) {
    return Response.json({ align, content: seedContent });
  }

  let content: CachedContent | null = null;
  if (align.kind === "pack" && align.pack) {
    try {
      content = await getCachedContent(align.id, async () => {
        const pack = await fetchPackForWeb(align.normalizedUrl);
        return { kind: "pack", files: pack.files };
      });
    } catch (error) {
      console.error("failed to fetch pack content", error);
      content = await getCachedContent(align.id);
    }
  } else {
    try {
      content = await fetchRawWithCache(align.id, align.normalizedUrl);
    } catch (error) {
      console.error("failed to fetch raw content", error);
      content = await getCachedContent(align.id);
    }
  }

  return Response.json({ align, content });
}
