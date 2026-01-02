import type { EventEnvelope } from "../envelopes/index.js";
import type { ProofRef, RunId, StepId, StepKind, StepRoute } from "./types.js";

export const EXECUTION_SCHEMA_VERSION = 1;

export const EXECUTION_EVENT_TYPES = {
  RunStarted: "run_started",
  RunCompleted: "run_completed",
  RunCancelled: "run_cancelled",
  StepAttempted: "step_attempted",
  StepSucceeded: "step_succeeded",
  StepFailed: "step_failed",
} as const;

export type ExecutionEventType =
  (typeof EXECUTION_EVENT_TYPES)[keyof typeof EXECUTION_EVENT_TYPES];

export interface RunStartedPayload {
  run_id: RunId;
  target_ref?: string;
}

export interface RunCompletedPayload {
  run_id: RunId;
}

export interface RunCancelledPayload {
  run_id: RunId;
  reason?: string;
}

export interface StepAttemptedPayload {
  run_id: RunId;
  step_id: StepId;
  kind: StepKind;
  route?: StepRoute | undefined;
  router_decision_ref?: string | undefined;
  requested_at: string;
}

export interface StepSucceededPayload {
  run_id: RunId;
  step_id: StepId;
  proof_refs: ProofRef[];
  router_decision_ref?: string | undefined;
  started_at: string;
  completed_at: string;
}

export interface StepFailedPayload {
  run_id: RunId;
  step_id: StepId;
  reason: string;
  proof_refs?: ProofRef[] | undefined;
  router_decision_ref?: string | undefined;
  started_at?: string | undefined;
  completed_at?: string | undefined;
}

export type ExecutionEvent =
  | EventEnvelope<
      (typeof EXECUTION_EVENT_TYPES)["RunStarted"],
      RunStartedPayload
    >
  | EventEnvelope<
      (typeof EXECUTION_EVENT_TYPES)["RunCompleted"],
      RunCompletedPayload
    >
  | EventEnvelope<
      (typeof EXECUTION_EVENT_TYPES)["RunCancelled"],
      RunCancelledPayload
    >
  | EventEnvelope<
      (typeof EXECUTION_EVENT_TYPES)["StepAttempted"],
      StepAttemptedPayload
    >
  | EventEnvelope<
      (typeof EXECUTION_EVENT_TYPES)["StepSucceeded"],
      StepSucceededPayload
    >
  | EventEnvelope<
      (typeof EXECUTION_EVENT_TYPES)["StepFailed"],
      StepFailedPayload
    >;
