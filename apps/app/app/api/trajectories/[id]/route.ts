import { NextResponse } from "next/server";
import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { getTrajectoryDetail } from "@/lib/trajectory-views";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!OPS_TRAJECTORIES_ENABLED) {
    return new NextResponse("Trajectories disabled", { status: 404 });
  }
  const detail = await getTrajectoryDetail(params.id);
  return NextResponse.json(detail);
}
