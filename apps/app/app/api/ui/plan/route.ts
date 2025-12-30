import { NextResponse } from "next/server";
import type { RenderRequest, RenderPlan } from "@aligntrue/ui-contracts";
import { getPlan, upsertPlan } from "@/lib/db";
import { ensureFixturePlan } from "@/lib/fixture-plan";
import { getOrCreateActorId } from "@/lib/actor";

export const runtime = "nodejs";

type StatusResponse =
  | {
      status: "pending_approval";
      plan_id: string;
      reasons: string[];
      actor_id: string;
    }
  | { status: "rejected"; plan_id: string; actor_id: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const planIdParam = url.searchParams.get("plan_id");
  const actor = getOrCreateActorId();

  const planRecord = planIdParam
    ? getPlan(planIdParam)
    : ensureFixturePlan().plan;
  if (!planRecord) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

  // If ensureFixturePlan returned a RenderPlan, coerce shape
  const plan =
    "plan_id" in planRecord
      ? (planRecord as RenderPlan & { status?: string })
      : {
          plan_id: planIdParam,
          core: planRecord.core,
          meta: planRecord.meta,
          status: planRecord.status,
        };

  const status = plan.status ?? "approved";
  if (status === "pending_approval") {
    const body: StatusResponse = {
      status: "pending_approval",
      plan_id: plan.plan_id,
      reasons: [],
      actor_id: actor.actor_id,
    };
    return NextResponse.json(body);
  }
  if (status === "rejected") {
    const body: StatusResponse = {
      status: "rejected",
      plan_id: plan.plan_id,
      actor_id: actor.actor_id,
    };
    return NextResponse.json(body);
  }

  return NextResponse.json({ ...plan, actor_id: actor.actor_id });
}

export async function POST(req: Request) {
  const actor = getOrCreateActorId();
  const now = new Date().toISOString();
  let requested: RenderRequest | undefined;
  try {
    requested = (await req.json()) as RenderRequest;
  } catch {
    // Stub: fall back to fixture plan
  }

  if (!requested) {
    const { plan_id, plan } = ensureFixturePlan();
    return NextResponse.json({ ...plan, actor_id: actor.actor_id, plan_id });
  }

  // Stub creation: for now, store the fixture but echo the request_id
  const { plan_id, plan } = ensureFixturePlan();
  upsertPlan({
    plan_id,
    core: plan.core,
    meta: {
      ...plan.meta,
      request_id: requested.request_id,
      correlation_id: requested.correlation_id ?? plan.meta.correlation_id,
    },
    status: "approved",
    created_at: now,
  });

  return NextResponse.json({ ...plan, actor_id: actor.actor_id, plan_id });
}
