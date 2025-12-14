import { getAlignStore } from "@/lib/aligns/storeFactory";
import { getPacksForRule, getRulesForPack } from "@/lib/aligns/relationships";

export const dynamic = "force-dynamic";

const store = getAlignStore();

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const align = await store.get(id);
  if (!align) {
    return Response.json({ error: "Align not found" }, { status: 404 });
  }

  if (align.kind === "pack") {
    const ruleIds = align.containsAlignIds?.length
      ? align.containsAlignIds
      : await getRulesForPack(id);
    const rules = ruleIds.length ? await store.getMultiple(ruleIds) : [];
    return Response.json({
      rules: rules.filter(Boolean),
      packs: [],
    });
  }

  const packIds = align.memberOfPackIds?.length
    ? align.memberOfPackIds
    : await getPacksForRule(id);
  const packs = packIds.length ? await store.getMultiple(packIds) : [];

  return Response.json({
    packs: packs.filter(Boolean),
    rules: [],
  });
}
