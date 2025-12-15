import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  setCachedContent,
  fetchRawWithCache,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { findSeedContent } from "@/lib/aligns/seedData";
import { filenameFromUrl } from "@/lib/aligns/urlUtils";

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
  if (align.kind === "pack") {
    const isCatalogPack =
      align.source === "catalog" && align.containsAlignIds?.length;
    if (isCatalogPack) {
      try {
        const ruleIds = align.containsAlignIds!;
        const rules = await store.getMultiple(ruleIds);
        const filesResult = await Promise.all(
          rules.filter(Boolean).map(async (rule) => {
            try {
              const raw = await fetchRawWithCache(
                rule!.id,
                rule!.normalizedUrl || rule!.url,
              );
              if (raw?.kind !== "single") return null;
              return {
                path: filenameFromUrl(rule!.normalizedUrl || rule!.url),
                size: raw.content.length,
                content: raw.content,
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
      } catch (error) {
        console.error("failed to fetch catalog pack content", error);
        content = await getCachedContent(align.id);
      }
    } else {
      // Fall back to any cached pack content if present (e.g., seed data)
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
