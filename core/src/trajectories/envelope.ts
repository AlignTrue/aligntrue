import { ValidationError } from "../errors.js";
import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { TrajectoryRefs } from "./refs.js";
import type {
  TrajectoryStepPayloadByType,
  TrajectoryStepType,
} from "./steps.js";

export const TRAJECTORY_ENVELOPE_VERSION = 1;

export interface TrajectoryEvent<
  T extends TrajectoryStepType = TrajectoryStepType,
> {
  schema_version: number;
  trajectory_id: string;
  step_seq: number;
  step_id: string;
  prev_step_hash: string | null;
  step_type: T;
  producer: "host" | "pack" | "derived" | "human";
  timestamp: string;
  causation: {
    parent_step_id?: string;
    related_command_id?: string; // primary hard link for writes
    related_event_id?: string;
    related_receipt_id?: string;
  };
  correlation_id: string; // secondary/loose grouping
  payload: TrajectoryStepPayloadByType[T];
  refs: TrajectoryRefs;
}

const REQUIRED_FIELDS: (keyof TrajectoryEvent)[] = [
  "schema_version",
  "trajectory_id",
  "step_seq",
  "step_id",
  "prev_step_hash",
  "step_type",
  "producer",
  "timestamp",
  "causation",
  "correlation_id",
  "payload",
  "refs",
];

export function validateTrajectoryEvent<T extends TrajectoryStepType>(
  candidate: Partial<TrajectoryEvent<T>>,
): TrajectoryEvent<T> {
  for (const field of REQUIRED_FIELDS) {
    if (candidate[field] === undefined) {
      throw new ValidationError(`Missing trajectory field: ${field}`);
    }
  }
  if (candidate.step_seq! < 0) {
    throw new ValidationError("step_seq must be non-negative", {
      step_seq: candidate.step_seq,
    });
  }
  if (!candidate.step_id) {
    throw new ValidationError("step_id required");
  }
  if (!candidate.trajectory_id) {
    throw new ValidationError("trajectory_id required");
  }
  if (typeof candidate.correlation_id !== "string") {
    throw new ValidationError("correlation_id required");
  }
  return candidate as TrajectoryEvent<T>;
}

export function computeStepId(input: {
  trajectory_id: string;
  step_seq: number;
  payload: unknown;
  prev_step_hash: string | null;
  step_type: TrajectoryStepType;
}): string {
  const content = {
    trajectory_id: input.trajectory_id,
    step_seq: input.step_seq,
    step_type: input.step_type,
    prev_step_hash: input.prev_step_hash,
    payload: input.payload,
  };
  return deterministicId(canonicalize(content));
}

export function buildTrajectoryEvent<T extends TrajectoryStepType>(input: {
  trajectory_id: string;
  step_seq: number;
  prev_step_hash: string | null;
  step_type: T;
  producer: "host" | "pack" | "derived" | "human";
  timestamp: string;
  causation?: {
    parent_step_id?: string;
    related_command_id?: string;
    related_event_id?: string;
    related_receipt_id?: string;
  };
  correlation_id: string;
  payload: TrajectoryStepPayloadByType[T];
  refs: TrajectoryRefs;
}): TrajectoryEvent<T> {
  const step_id = computeStepId({
    trajectory_id: input.trajectory_id,
    step_seq: input.step_seq,
    prev_step_hash: input.prev_step_hash,
    payload: input.payload,
    step_type: input.step_type,
  });

  return validateTrajectoryEvent({
    schema_version: TRAJECTORY_ENVELOPE_VERSION,
    trajectory_id: input.trajectory_id,
    step_seq: input.step_seq,
    step_id,
    prev_step_hash: input.prev_step_hash,
    step_type: input.step_type,
    producer: input.producer,
    timestamp: input.timestamp,
    causation: input.causation ?? {},
    correlation_id: input.correlation_id,
    payload: input.payload,
    refs: input.refs,
  });
}
