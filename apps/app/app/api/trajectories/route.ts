import { NextResponse } from "next/server";
import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { getTrajectoryList } from "@/lib/trajectory-views";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!OPS_TRAJECTORIES_ENABLED) {
    return new NextResponse("Trajectories disabled", { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const entity_ref = searchParams.get("entity_ref") ?? undefined;
  const time_after = searchParams.get("time_after") ?? undefined;
  const time_before = searchParams.get("time_before") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : undefined;
  const limit =
    parsedLimit !== undefined && !isNaN(parsedLimit) ? parsedLimit : undefined;

  const result = await getTrajectoryList({
    entity_ref,
    time_after,
    time_before,
    cursor,
    limit,
  });
  return NextResponse.json(result);
}
