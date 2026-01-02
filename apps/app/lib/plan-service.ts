import { hashCanonical, type ActorRef } from "@aligntrue/core";
import type {
  LayoutIntentCore,
  PlanMode,
  PlanReceipt,
  RenderPlan,
  RenderRequest,
} from "@aligntrue/ui-contracts";
import { buildRenderPlan } from "@aligntrue/ui-renderer";
import {
  compilePlan,
  CompilerError,
  type CompilerPolicy,
} from "./plan-compiler";
import {
  insertPlanArtifact,
  insertPlanEvent,
  insertPlanReceipt,
  insertPlanServedEvent,
  getReceiptByIdempotencyKey,
  getPlanArtifact,
  runInTransaction,
  isUniqueConstraintError,
} from "./db";
import {
  mapDbReceipt,
  type DbPlanReceipt,
  type DbPlanArtifact,
} from "./db-types";
import {
  computeIdempotencyKey,
  buildPlanReceipt,
} from "./plan-receipt-builder";
import type { UIContext } from "./ui-context";
import type { createPlatformRegistry } from "@aligntrue/ui-blocks";

export interface PlanInputs {
  context: UIContext;
  policy: CompilerPolicy;
  layoutIntentCore?: LayoutIntentCore;
  mode: PlanMode;
  workspace_id?: string;
  actor: ActorRef;
  causation_id?: string;
  causation_type?: string;
  ai_result?: {
    provider: string;
    model?: string;
    ai_failed?: boolean;
    ai_failed_reason?: string;
  };
  allowed_manifest_hashes: ReadonlySet<string>;
  allowed_block_types: ReadonlySet<string>;
  registry: ReturnType<typeof createPlatformRegistry>;
}

export interface PlanResult {
  plan: RenderPlan;
  receipt: PlanReceipt;
  was_cached: boolean;
}

export class PlanArtifactMissingError extends Error {
  constructor(readonly planId: string) {
    super(`Plan artifact missing for plan_id=${planId}`);
    this.name = "PlanArtifactMissingError";
  }
}

export function getOrCreatePlanAndReceipt(inputs: PlanInputs): PlanResult {
  const idempotencyKey = computeIdempotencyKey({
    context_hash: inputs.context.context_hash,
    policy_id: inputs.policy.policy_id,
    policy_version: inputs.policy.version,
    policy_hash: inputs.policy.policy_hash,
    layout_intent_core_hash: inputs.layoutIntentCore
      ? hashCanonical(inputs.layoutIntentCore)
      : null,
    mode: inputs.mode,
  });

  return runInTransaction(() => {
    const existingRow = getReceiptByIdempotencyKey(idempotencyKey);
    if (existingRow) {
      return loadCachedPlan(existingRow, idempotencyKey);
    }

    const compiled = compilePlan({
      context: inputs.context,
      policy: inputs.policy,
      layoutIntentCore: inputs.layoutIntentCore,
      allowed_manifest_hashes: inputs.allowed_manifest_hashes,
      allowed_block_types: inputs.allowed_block_types,
    });

    // correlation_id must be stable; use idempotencyKey
    const renderRequest: RenderRequest = {
      request_id: compiled.request_id,
      blocks: compiled.blocks.map((b) => ({
        block_instance_id: b.block_instance_id,
        block_type: b.block_type,
        props: b.props,
        slot: b.slot,
      })),
      layout: { template: compiled.layout.template },
      input_refs: [],
      correlation_id: idempotencyKey,
      actor: inputs.actor,
    };

    const renderPlan = buildRenderPlan(renderRequest, inputs.registry, {
      now: new Date().toISOString(),
    });

    const render_request_hash = hashCanonical(renderRequest);

    insertPlanArtifact({
      plan_id: compiled.request_id,
      compiled_plan_json: JSON.stringify(compiled),
      render_request_json: JSON.stringify(renderRequest),
      render_plan_json: JSON.stringify(renderPlan),
      render_request_hash,
      created_at: new Date().toISOString(),
    });

    const receipt = buildPlanReceipt(compiled, {
      idempotency_key: idempotencyKey,
      render_request_hash,
      mode: inputs.mode,
      workspace_id: inputs.workspace_id,
      policy: inputs.policy,
      context_hash: inputs.context.context_hash,
      layout_intent_core_hash: inputs.layoutIntentCore
        ? hashCanonical(inputs.layoutIntentCore)
        : undefined,
      actor: inputs.actor,
      causation_id: inputs.causation_id,
      causation_type: inputs.causation_type,
      ai_result: inputs.ai_result,
    });

    const ingested_at = new Date().toISOString();
    try {
      insertPlanReceipt({
        ...receipt,
        ingested_at,
        ai_failed:
          receipt.ai_failed === undefined ? null : receipt.ai_failed ? 1 : 0,
        ai_failed_reason: receipt.ai_failed_reason ?? null,
        model: receipt.model ?? null,
        workspace_id: receipt.workspace_id ?? null,
        layout_intent_core_hash: receipt.layout_intent_core_hash ?? null,
        causation_id: receipt.causation_id ?? null,
        causation_type: receipt.causation_type ?? null,
      } as DbPlanReceipt);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const winnerRow = getReceiptByIdempotencyKey(idempotencyKey);
        if (winnerRow) {
          return loadCachedPlan(winnerRow, idempotencyKey);
        }
      }
      throw error;
    }

    return {
      plan: renderPlan,
      receipt: { ...receipt, ingested_at },
      was_cached: false,
    };
  });
}

export function logServeEvent(params: {
  receipt: PlanReceipt;
  workspace_id?: string;
  correlation_id: string;
  actor: { actor_id: string; actor_type: string };
}): void {
  insertPlanServedEvent({
    event_id: crypto.randomUUID(),
    receipt_id: params.receipt.receipt_id,
    plan_id: params.receipt.plan_id,
    idempotency_key: params.receipt.idempotency_key,
    workspace_id: params.workspace_id ?? null,
    served_at: new Date().toISOString(),
    correlation_id: params.correlation_id,
    actor_id: params.actor.actor_id,
    actor_type: params.actor.actor_type,
  });
}

export function loadCachedPlan(
  row: DbPlanReceipt,
  idempotencyKey: string,
): PlanResult {
  const receipt = mapDbReceipt(row);
  const artifact = getPlanArtifact(receipt.plan_id) as DbPlanArtifact | null;
  if (!artifact) {
    insertPlanEvent({
      event_id: crypto.randomUUID(),
      event_type: "ui.plan.artifact_missing",
      plan_id: receipt.plan_id,
      idempotency_key: idempotencyKey,
      receipt_id: receipt.receipt_id,
      occurred_at: new Date().toISOString(),
      details_json: JSON.stringify({
        message: "Receipt exists but artifact missing",
      }),
    });
    throw new PlanArtifactMissingError(receipt.plan_id);
  }

  return {
    plan: JSON.parse(artifact.render_plan_json) as RenderPlan,
    receipt,
    was_cached: true,
  };
}

export { CompilerError };
