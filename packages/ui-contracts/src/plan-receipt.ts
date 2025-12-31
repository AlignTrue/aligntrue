export type PlanMode = "deterministic" | "ai";
export type PolicyStage =
  | "draft"
  | "simulated"
  | "approved"
  | "active"
  | "deprecated";

export interface PlanReceipt {
  readonly receipt_id: string;
  readonly plan_id: string;
  readonly idempotency_key: string;
  readonly mode: PlanMode;
  readonly workspace_id?: string;
  readonly occurred_at: string;
  readonly ingested_at: string;
  readonly provider: string;
  readonly model?: string;
  readonly ai_failed?: boolean;
  readonly ai_failed_reason?: string;
  readonly policy_id: string;
  readonly policy_version: string;
  readonly policy_hash: string;
  readonly policy_stage: PolicyStage;
  readonly compiler_version: string;
  readonly context_hash: string;
  readonly layout_intent_core_hash?: string;
  readonly render_request_hash: string; // Hash of RenderRequest
  readonly causation_id?: string;
  readonly causation_type?: string;
  readonly actor_id: string;
  readonly actor_type: string;
}
