import { getAlignStore } from "@/lib/aligns/storeFactory";

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
  return Response.json(align);
}
