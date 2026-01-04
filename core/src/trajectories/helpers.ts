import type { ArtifactStore } from "../storage/interfaces.js";
import {
  buildOutcome,
  type OutcomeRecorded,
  type OutcomeKind,
} from "./outcome.js";
import { buildTrajectoryEvent, type TrajectoryEvent } from "./envelope.js";
import {
  type TrajectoryStepPayloadByType,
  type TrajectoryStepType,
  type OverlayStepType,
} from "./steps.js";
import { summarizeToolArgs, summarizeToolResult } from "./redaction.js";
import type { TrajectoryRefs } from "./refs.js";
import type { ArtifactRef } from "../entity-ref.js";
import type { TrajectoryEvent as TEvt } from "./envelope.js";
import type { RefLinkType } from "./refs.js";
import { entityRef, type EntityType } from "../entity-ref.js";

export const TrajectoryHelpers = {
  createStep<T extends TrajectoryStepType>(opts: {
    trajectory_id: string;
    step_seq: number;
    prev_step_hash: string | null;
    step_type: T;
    producer: "host" | "pack" | "derived" | "human";
    correlation_id: string;
    payload: TrajectoryStepPayloadByType[T];
    refs: TrajectoryRefs;
    causation?: TEvt["causation"];
    timestamp?: string;
  }): TrajectoryEvent<T> {
    return buildTrajectoryEvent({
      trajectory_id: opts.trajectory_id,
      step_seq: opts.step_seq,
      prev_step_hash: opts.prev_step_hash,
      step_type: opts.step_type,
      producer: opts.producer,
      timestamp: opts.timestamp ?? new Date().toISOString(),
      correlation_id: opts.correlation_id,
      payload: opts.payload,
      refs: opts.refs,
      ...(opts.causation !== undefined ? { causation: opts.causation } : {}),
    });
  },

  async createToolCallStep(opts: {
    trajectory_id: string;
    step_seq: number;
    prev_step_hash: string | null;
    correlation_id: string;
    tool_name: string;
    args: unknown;
    result?: unknown;
    refs: TrajectoryRefs;
    artifactStore?: ArtifactStore<unknown, unknown>;
    timestamp?: string;
  }): Promise<TrajectoryEvent<"tool_called">> {
    const payload: TrajectoryStepPayloadByType["tool_called"] = {
      tool_name: opts.tool_name,
      args_summary: summarizeToolArgs(opts.args),
    };

    if (opts.result !== undefined) {
      payload.result_summary = summarizeToolResult(opts.result);
    }

    return buildTrajectoryEvent({
      trajectory_id: opts.trajectory_id,
      step_seq: opts.step_seq,
      prev_step_hash: opts.prev_step_hash,
      step_type: "tool_called",
      producer: "host",
      timestamp: opts.timestamp ?? new Date().toISOString(),
      correlation_id: opts.correlation_id,
      payload,
      refs: opts.refs,
    });
  },

  createEntityRef(type: EntityType, id: string, link: RefLinkType) {
    return { ref: entityRef(type, id), link };
  },

  createOutcome(opts: {
    trajectory_id?: string;
    command_id?: string;
    kind: OutcomeKind;
    severity: 0 | 1 | 2 | 3 | 4 | 5;
    metrics: Record<string, number>;
    notes?: string;
    refs: TrajectoryRefs;
    timestamp?: string;
  }): OutcomeRecorded {
    const attaches_to: { trajectory_id?: string; command_id?: string } = {};
    if (opts.trajectory_id !== undefined)
      attaches_to.trajectory_id = opts.trajectory_id;
    if (opts.command_id !== undefined) attaches_to.command_id = opts.command_id;

    return buildOutcome({
      outcome_id: opts.trajectory_id
        ? `${opts.trajectory_id}-outcome-${opts.kind}`
        : `outcome-${opts.kind}`,
      attaches_to,
      kind: opts.kind,
      severity: opts.severity,
      metrics: opts.metrics,
      ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      refs: opts.refs,
      timestamp: opts.timestamp ?? new Date().toISOString(),
    });
  },

  createOverlayStep(opts: {
    trajectory_id: string;
    step_seq: number;
    prev_step_hash: string | null;
    step_type: OverlayStepType;
    producer: "pack" | "derived" | "human";
    correlation_id: string;
    payload: TrajectoryStepPayloadByType[OverlayStepType];
    refs: TrajectoryRefs;
    evidence_artifact_ref: ArtifactRef;
    timestamp?: string;
  }): TrajectoryEvent {
    const refs: TrajectoryRefs = {
      ...opts.refs,
      artifact_refs: [
        ...(opts.refs.artifact_refs ?? []),
        { ref: opts.evidence_artifact_ref, link: "observed" },
      ],
    };

    return buildTrajectoryEvent({
      trajectory_id: opts.trajectory_id,
      step_seq: opts.step_seq,
      prev_step_hash: opts.prev_step_hash,
      step_type: opts.step_type,
      producer: opts.producer,
      timestamp: opts.timestamp ?? new Date().toISOString(),
      correlation_id: opts.correlation_id,
      payload: opts.payload,
      refs,
    });
  },
};
