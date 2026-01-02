import { getAlignStore } from "@/lib/aligns/storeFactory";

export const dynamic = "force-dynamic";

const store = getAlignStore();

type EventBody = {
  type: "view" | "install";
};

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as EventBody | null;
  if (!body || (body.type !== "view" && body.type !== "install")) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }

  const field = body.type === "view" ? "viewCount" : "installClickCount";
  await store.increment(id, field);
  return new Response(null, { status: 204 });
}
