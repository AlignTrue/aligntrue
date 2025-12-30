import { NextResponse } from "next/server";
import { getPlan, getLatestState, getStateVersion } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const plan_id = url.searchParams.get("plan_id");
  const versionParam = url.searchParams.get("version");

  if (!plan_id) {
    return NextResponse.json({ error: "plan_id_required" }, { status: 400 });
  }

  const plan = getPlan(plan_id);
  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  if (plan.status === "pending_approval") {
    return NextResponse.json({
      status: "pending_approval",
      plan_id,
      state: {
        version: 0,
        content: { selections: {}, form_values: {}, expanded_sections: [] },
      },
    });
  }

  if (plan.status === "rejected") {
    return NextResponse.json({ error: "plan_rejected" }, { status: 403 });
  }

  const state =
    versionParam !== null
      ? getStateVersion(plan_id, Number(versionParam))
      : getLatestState(plan_id);

  if (!state) {
    return NextResponse.json({
      plan_id,
      state: {
        version: 0,
        content: { selections: {}, form_values: {}, expanded_sections: [] },
      },
    });
  }

  return NextResponse.json({ plan_id, state });
}
