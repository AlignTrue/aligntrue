import { NextResponse } from "next/server";
import { Projections } from "@aligntrue/core";
import { getEventStore, getHost } from "@/lib/ops-services";

export async function GET() {
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    Projections.ConversationsProjectionDef,
    getEventStore(),
  );
  const projection = Projections.buildConversationsProjectionFromState(
    rebuilt.data as Projections.ConversationsProjectionState,
  );
  return NextResponse.json({ conversations: projection.conversations });
}
