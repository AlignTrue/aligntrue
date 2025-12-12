import { getAlignStore } from "@/lib/aligns/storeFactory";
import type { AlignRecord } from "@/lib/aligns/types";

export const dynamic = "force-dynamic";

const store = getAlignStore();

type SortOption = "recent" | "popular";
type KindOption = "rule" | "pack";

function parseNumber(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const raw = searchParams.get(key);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function toSummary(record: AlignRecord) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    provider: record.provider,
    normalizedUrl: record.normalizedUrl,
    kind: record.kind,
    url: record.url,
    pack: record.pack,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? undefined;
  const kind = (searchParams.get("kind") as KindOption | null) ?? undefined;
  const sort = (searchParams.get("sort") as SortOption | null) ?? "recent";
  const limit = parseNumber(searchParams, "limit", 9, 1, 50);
  const offset = parseNumber(searchParams, "offset", 0, 0, 10_000);

  const result = await store.search({
    query,
    kind,
    sortBy: sort,
    limit,
    offset,
  });

  return Response.json({
    items: result.items.map(toSummary),
    total: result.total,
  });
}
