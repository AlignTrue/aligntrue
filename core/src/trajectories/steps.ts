import type { ArtifactRef, TrajectoryRefs } from "./refs.js";

// Base steps (host-emitted, deterministic)
export const BASE_STEPS = [
  "trajectory_started",
  "trajectory_ended",
  "tool_called",
  "entity_read",
  "entity_written",
  "policy_gate_hit",
  "external_egress_attempted",
  "artifact_emitted",
  "step_failed",
  "step_retried",
  "result_superseded",
] as const;

// Overlay steps (semantic, fallible)
export const OVERLAY_STEPS = [
  "hypothesis",
  "alternative_considered",
  "decision_rationale",
] as const;

export type BaseStepType = (typeof BASE_STEPS)[number];
export type OverlayStepType = (typeof OVERLAY_STEPS)[number];
export type TrajectoryStepType = BaseStepType | OverlayStepType;

export interface ToolCallSummary {
  tool_name: string;
  args_summary: string; // human-readable summary, NOT raw
  args_artifact_ref?: ArtifactRef; // raw args stored separately with redaction
  result_summary?: string;
  result_artifact_ref?: ArtifactRef; // raw result stored separately with redaction
}

export interface TrajectoryStepPayloadByType {
  trajectory_started: { trigger: string; context?: Record<string, unknown> };
  trajectory_ended: { outcome_summary?: string };
  tool_called: ToolCallSummary;
  entity_read: { entity_ref: string; fields?: string[] };
  entity_written: { entity_ref: string; command_id: string };
  policy_gate_hit: {
    policy_id: string;
    result: "allow" | "deny";
    reason?: string;
  };
  external_egress_attempted: { destination: string; approved: boolean };
  artifact_emitted: { artifact_id: string; artifact_type: string };
  step_failed: { error: string; recoverable: boolean };
  step_retried: { retry_count: number; reason: string };
  result_superseded: { superseded_by: string; reason: string };
  // Overlays
  hypothesis: { statement: string; confidence: number; grounding: string[] };
  alternative_considered: { option: string; rejected_reason: string };
  decision_rationale: { decision: string; factors: string[] };
}

export type TrajectoryStepPayload<
  T extends TrajectoryStepType = TrajectoryStepType,
> = TrajectoryStepPayloadByType[T];

export function isBaseStep(step: TrajectoryStepType): step is BaseStepType {
  return (BASE_STEPS as readonly string[]).includes(step);
}

export function isOverlayStep(
  step: TrajectoryStepType,
): step is OverlayStepType {
  return (OVERLAY_STEPS as readonly string[]).includes(step);
}

export interface TrajectoryStep<
  T extends TrajectoryStepType = TrajectoryStepType,
> {
  step_type: T;
  payload: TrajectoryStepPayload<T>;
  refs: TrajectoryRefs;
}
