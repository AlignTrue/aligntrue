import { NextResponse } from "next/server";
import { getPlan, updatePlanStatus } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { plan_id: string; decision: "approve" | "reject" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const plan = getPlan(body.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  if (body.decision === "approve") {
    updatePlanStatus(body.plan_id, "approved");
    return NextResponse.json({ status: "approved", plan_id: body.plan_id });
  }

  updatePlanStatus(body.plan_id, "rejected");
  return NextResponse.json({ status: "rejected", plan_id: body.plan_id });
}
