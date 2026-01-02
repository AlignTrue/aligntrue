import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type {
  RenderPlan,
  RenderRequest,
  RequiredSurface,
} from "@aligntrue/ui-contracts";
import { buildRenderPlan } from "@aligntrue/ui-renderer";
import { createPlatformRegistry } from "@aligntrue/ui-blocks/registry";
import {
  getPlan,
  upsertPlan,
  type PlanStatus,
  insertPlanDebug,
} from "@/lib/db";
import { ensureFixturePlan } from "@/lib/fixture-plan";
import { getOrCreateActorId } from "@/lib/actor";
import { buildUIContext } from "@/lib/ui-context";
import { generateRenderPlan } from "@/lib/ai-generation";
import { DEFAULT_POLICY } from "@/lib/default-policy";
import {
  CompilerError,
  PlanArtifactMissingError,
  getOrCreatePlanAndReceipt,
  logServeEvent,
} from "@/lib/plan-service";
import { Projections, hashCanonical } from "@aligntrue/ops-core";
import { getEventStore, getHost } from "@/lib/ops-services";

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
  const mode = url.searchParams.get("mode") ?? "fixture";
  const planIdParam = url.searchParams.get("plan_id");
  const actor = await getOrCreateActorId();
  const policy = await loadPolicyForActor(actor.actor_id);

  if (mode === "ai") {
    const registry = createPlatformRegistry();
    const manifests = Array.from(registry.blocks.values()).map(
      (entry) => entry.manifest,
    );

    const intentParam = url.searchParams.get("intent");
    const scopeParam = url.searchParams.get("scope");
    const intent: "list" | "detail" | "create" | "dashboard" | "triage" =
      intentParam === "detail" ||
      intentParam === "create" ||
      intentParam === "dashboard" ||
      intentParam === "triage"
        ? intentParam
        : "list";
    const scope: "today" | "week" | "all" | "search" =
      scopeParam === "week" || scopeParam === "all" || scopeParam === "search"
        ? scopeParam
        : "today";

    const context = await buildUIContext({
      intent,
      scope,
    });
    const ai = await generateRenderPlan({
      context,
      manifests,
      actor,
    });
    if (!ai.request) {
      return NextResponse.json(
        { error: "plan_generation_failed", errors: ai.errors },
        { status: 500 },
      );
    }

    const created_at = new Date().toISOString();
    const plan = buildRenderPlan(ai.request, registry, {
      now: created_at,
    });

    upsertPlan({
      plan_id: plan.plan_id,
      core: plan.core,
      meta: plan.meta,
      status: "approved",
      created_at,
    });

    insertPlanDebug({
      plan_id: plan.plan_id,
      render_request_json: ai.request,
      validation_errors_json: ai.errors.length > 0 ? ai.errors : null,
      manifests_hash: registry.manifestsHash,
      context_hash: context.context_hash,
      attempts: ai.attempts,
      created_at,
    });

    return NextResponse.json({ ...plan, actor_id: actor.actor_id });
  }

  if (mode === "compiled") {
    const registry = createPlatformRegistry();
    const manifests = Array.from(registry.blocks.values()).map(
      (entry) => entry.manifest,
    );
    const allowed_manifest_hashes = new Set(
      manifests.map((m) => m.manifest_hash),
    );
    const allowed_block_types = new Set(manifests.map((m) => m.block_id));

    const intentParam = url.searchParams.get("intent");
    const scopeParam = url.searchParams.get("scope");
    const intent: "list" | "detail" | "create" | "dashboard" | "triage" =
      intentParam === "detail" ||
      intentParam === "create" ||
      intentParam === "dashboard" ||
      intentParam === "triage"
        ? intentParam
        : "list";
    const scope: "today" | "week" | "all" | "search" =
      scopeParam === "week" || scopeParam === "all" || scopeParam === "search"
        ? scopeParam
        : "today";

    const context = await buildUIContext({ intent, scope });
    const correlation_id = crypto.randomUUID();

    try {
      const result = getOrCreatePlanAndReceipt({
        context,
        policy,
        mode: "deterministic",
        actor,
        workspace_id: undefined,
        allowed_manifest_hashes,
        allowed_block_types,
        registry,
      });

      logServeEvent({
        receipt: result.receipt,
        workspace_id: undefined,
        correlation_id,
        actor,
      });

      return NextResponse.json({
        ...result.plan,
        actor_id: actor.actor_id,
        receipt_id: result.receipt.receipt_id,
      });
    } catch (error) {
      if (error instanceof PlanArtifactMissingError) {
        return NextResponse.json(
          { error: "plan_artifact_missing", plan_id: error.planId },
          { status: 500 },
        );
      }
      if (error instanceof CompilerError) {
        return NextResponse.json(
          { error: "plan_compile_failed", message: error.message },
          { status: 500 },
        );
      }
      throw error;
    }
  }

  const plan = planIdParam
    ? (getPlan(planIdParam) as (RenderPlan & { status: PlanStatus }) | null)
    : ((await ensureFixturePlan()).plan as RenderPlan & { status: PlanStatus });

  if (!plan) {
    return NextResponse.json({ error: "plan_not_found" }, { status: 404 });
  }

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
  const actor = await getOrCreateActorId();
  const now = new Date().toISOString();
  let requested: RenderRequest | undefined;
  try {
    requested = (await req.json()) as RenderRequest;
  } catch {
    // Stub: fall back to fixture plan
  }

  if (!requested) {
    const { plan_id, plan } = await ensureFixturePlan();
    return NextResponse.json({ ...plan, actor_id: actor.actor_id, plan_id });
  }

  // Stub creation: for now, store the fixture but echo the request_id
  const { plan_id, plan } = await ensureFixturePlan();
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

async function loadPolicyForActor(userId: string) {
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    Projections.ActivePolicyProjectionDef,
    getEventStore(),
  );
  const state = Projections.buildActivePolicyProjectionFromState(rebuilt.data);
  const active = state.by_user.get(userId);
  if (!active) return DEFAULT_POLICY;

  const base = {
    ...DEFAULT_POLICY,
    required_surfaces_by_intent: active.surfaces_by_intent as Record<
      string,
      RequiredSurface[]
    >,
  };
  const policy_hash = hashCanonical({
    policy_id: active.active_policy_id,
    version: base.version,
    stage: base.stage,
    required_surfaces_by_intent: base.required_surfaces_by_intent,
    default_layout: base.default_layout,
    surface_to_block: base.surface_to_block,
  });
  return {
    ...base,
    policy_id: active.active_policy_id,
    policy_hash,
  };
}
