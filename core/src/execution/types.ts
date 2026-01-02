import type { ActorRef } from "../envelopes/actor.js";
import { SafetyClass } from "../safety-classes/types.js";

export type RunId = string;
export type StepId = string;
export type ProofRef = string;

export const STEP_ROUTES = {
  DeterministicRequired: "DETERMINISTIC_REQUIRED",
  ModelAllowed: "MODEL_ALLOWED",
} as const;
export type StepRoute = (typeof STEP_ROUTES)[keyof typeof STEP_ROUTES];

export const STEP_KINDS = {
  Lookup: "lookup",
  Transform: "transform",
  Validate: "validate",
  Classify: "classify",
  Summarize: "summarize",
  Generate: "generate",
  Unknown: "unknown",
} as const;
export type StepKind = (typeof STEP_KINDS)[keyof typeof STEP_KINDS] | string;

export interface RouterInput {
  run_id: RunId;
  step_id: StepId;
  kind: StepKind;
  safety_class?: SafetyClass;
  metadata?: Record<string, unknown>;
}

export interface RouterDecision {
  route: StepRoute;
  reason: string;
  policy_version: string;
  inputs_hash: string;
}

export interface RouterReceiptContent {
  run_id: RunId;
  step_id: StepId;
  kind: StepKind;
  decision: RouterDecision;
  created_at: string;
  created_by: ActorRef;
  correlation_id: string;
}

export interface UsageReceiptContent {
  run_id: RunId;
  step_id?: StepId | undefined;
  model_id?: string | undefined;
  tokens_in?: number | undefined;
  tokens_out?: number | undefined;
  duration_ms?: number | undefined;
  allowed: boolean;
  reason?: string | undefined;
  created_at: string;
  created_by: ActorRef;
  correlation_id: string;
}

export type RunStatus = "running" | "completed" | "cancelled";

export type StepStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface StepState {
  step_id: StepId;
  kind: StepKind;
  route?: StepRoute | undefined;
  status: StepStatus;
  proof_refs: ProofRef[];
  router_decision_ref?: string | undefined;
  started_at: string;
  completed_at?: string | undefined;
  reason?: string | undefined;
}

export interface RunState {
  run_id: RunId;
  status: RunStatus;
  steps: Map<StepId, StepState>;
  started_at: string;
  completed_at?: string | undefined;
}
