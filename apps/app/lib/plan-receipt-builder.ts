import { hashCanonical } from "@aligntrue/ops-core";
import type {
  PlanMode,
  PlanReceipt,
  CompiledPlan,
} from "@aligntrue/ui-contracts";

const COMPILER_VERSION = "1.0.0";

export interface PolicyRecord {
  readonly policy_id: string;
  readonly version: string;
  readonly policy_hash: string;
  readonly stage: string;
}

export interface BuildReceiptInputs {
  readonly idempotency_key: string;
  readonly render_request_hash: string; // hashCanonical of RenderRequest
  readonly mode: PlanMode;
  readonly workspace_id?: string;
  readonly policy: PolicyRecord;
  readonly context_hash: string;
  readonly layout_intent_core_hash?: string;
  readonly actor: { actor_id: string; actor_type: string };
  readonly causation_id?: string;
  readonly causation_type?: string;
  readonly ai_result?: {
    provider: string;
    model?: string;
    ai_failed?: boolean;
    ai_failed_reason?: string;
  };
}

export function computeIdempotencyKey(params: {
  context_hash: string;
  policy_id: string;
  policy_version: string;
  policy_hash: string;
  layout_intent_core_hash: string | null;
  mode: PlanMode;
}): string {
  return hashCanonical({
    context_hash: params.context_hash,
    policy_id: params.policy_id,
    policy_version: params.policy_version,
    policy_hash: params.policy_hash,
    layout_intent_core_hash: params.layout_intent_core_hash ?? "none",
    mode: params.mode,
  });
}

export function buildPlanReceipt(
  compiled: CompiledPlan,
  inputs: BuildReceiptInputs,
): Omit<PlanReceipt, "ingested_at"> {
  return {
    receipt_id: crypto.randomUUID(),
    plan_id: compiled.request_id,
    idempotency_key: inputs.idempotency_key,
    render_request_hash: inputs.render_request_hash,
    mode: inputs.mode,
    workspace_id: inputs.workspace_id,
    occurred_at: new Date().toISOString(),
    provider: inputs.ai_result?.provider ?? "deterministic",
    model: inputs.ai_result?.model,
    ai_failed: inputs.ai_result?.ai_failed,
    ai_failed_reason: inputs.ai_result?.ai_failed_reason,
    policy_id: inputs.policy.policy_id,
    policy_version: inputs.policy.version,
    policy_hash: inputs.policy.policy_hash,
    policy_stage: inputs.policy.stage as PlanReceipt["policy_stage"],
    compiler_version: COMPILER_VERSION,
    context_hash: inputs.context_hash,
    layout_intent_core_hash: inputs.layout_intent_core_hash,
    causation_id: inputs.causation_id,
    causation_type: inputs.causation_type,
    actor_id: inputs.actor.actor_id,
    actor_type: inputs.actor.actor_type,
  };
}
