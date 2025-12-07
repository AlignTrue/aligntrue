import { getAlignStore } from "@/lib/aligns/storeFactory";

export const dynamic = "force-dynamic";

const store = getAlignStore();

function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : 8;
  if (Number.isNaN(parsed) || parsed <= 0) return 8;
  return Math.min(parsed, 50);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams);
  const aligns = await store.listPopular(limit);
  return Response.json(aligns);
}
