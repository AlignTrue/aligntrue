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
  const trajectory_id = decodeURIComponent(params.id);
  const detail = await getTrajectoryDetail(trajectory_id);
  if (!detail) {
    return new NextResponse("Trajectory not found", { status: 404 });
  }
  return NextResponse.json(detail);
}
