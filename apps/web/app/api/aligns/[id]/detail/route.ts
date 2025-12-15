import { getAlignStore } from "@/lib/aligns/storeFactory";
import {
  getCachedContent,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { fetchPackContent } from "@/lib/aligns/pack-content";

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
  try {
    content = await fetchPackContent(align, store);
  } catch (error) {
    console.error("failed to fetch content", error);
    content = await getCachedContent(align.id);
  }

  return Response.json({ align, content });
}
