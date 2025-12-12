import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  fetchRawWithCache,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { fetchPackForWeb } from "@/lib/aligns/pack-fetcher";

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

  let content: CachedContent | null = null;
  if (align.kind === "pack" && align.pack) {
    content = await getCachedContent(align.id, async () => {
      const pack = await fetchPackForWeb(align.url);
      return { kind: "pack", files: pack.files };
    });
  } else {
    content = await fetchRawWithCache(align.id, align.normalizedUrl);
  }

  return Response.json({ align, content });
}
