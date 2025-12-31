import type {
  PlanReceipt,
  PlanMode,
  PolicyStage,
} from "@aligntrue/ui-contracts";

// DB row shapes (snake_case, matches columns)
export interface DbPlanReceipt {
  receipt_id: string;
  plan_id: string;
  idempotency_key: string;
  mode: string;
  workspace_id: string | null;
  occurred_at: string;
  ingested_at: string;
  provider: string;
  model: string | null;
  ai_failed: number; // SQLite: 0 or 1
  ai_failed_reason: string | null;
  policy_id: string;
  policy_version: string;
  policy_hash: string;
  policy_stage: string;
  compiler_version: string;
  context_hash: string;
  layout_intent_core_hash: string | null;
  render_request_hash: string;
  causation_id: string | null;
  causation_type: string | null;
  actor_id: string;
  actor_type: string;
}

export interface DbPlanArtifact {
  plan_id: string;
  compiled_plan_json: string;
  render_request_json: string;
  render_plan_json: string;
  render_request_hash: string;
  created_at: string;
}

// Map DB row to TS type
export function mapDbReceipt(row: DbPlanReceipt): PlanReceipt {
  return {
    receipt_id: row.receipt_id,
    plan_id: row.plan_id,
    idempotency_key: row.idempotency_key,
    mode: row.mode as PlanMode,
    workspace_id: row.workspace_id ?? undefined,
    occurred_at: row.occurred_at,
    ingested_at: row.ingested_at,
    provider: row.provider,
    model: row.model ?? undefined,
    ai_failed: row.ai_failed === 1,
    ai_failed_reason: row.ai_failed_reason ?? undefined,
    policy_id: row.policy_id,
    policy_version: row.policy_version,
    policy_hash: row.policy_hash,
    policy_stage: row.policy_stage as PolicyStage,
    compiler_version: row.compiler_version,
    context_hash: row.context_hash,
    layout_intent_core_hash: row.layout_intent_core_hash ?? undefined,
    render_request_hash: row.render_request_hash,
    causation_id: row.causation_id ?? undefined,
    causation_type: row.causation_type ?? undefined,
    actor_id: row.actor_id,
    actor_type: row.actor_type,
  };
}
