import { NextResponse } from "next/server";
import { getPlan } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    plan_id: string;
    render_instance_id: string;
    blocks_rendered: string[];
    rendered_at: string;
    actor_id: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const plan = getPlan(body.plan_id);
  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  // Non-authoritative telemetry
  console.info("[telemetry] ui.plan.rendered", {
    ...body,
    source: "client_telemetry",
  });

  return NextResponse.json({ ok: true });
}
