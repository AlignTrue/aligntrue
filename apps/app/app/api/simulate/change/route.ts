import { NextResponse } from "next/server";
import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { runChangeSimulation } from "@/lib/simulation-views";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!OPS_TRAJECTORIES_ENABLED) {
    return new NextResponse("Trajectories disabled", { status: 404 });
  }
  const body = (await req.json()) ?? {};
  const result = await runChangeSimulation(body);
  return NextResponse.json(result);
}
