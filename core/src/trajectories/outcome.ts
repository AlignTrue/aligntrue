import { ValidationError } from "../errors.js";
import type { TrajectoryRefs } from "./refs.js";

export const OUTCOME_SCHEMA_VERSION = 1;

export type OutcomeKind =
  | "success"
  | "rollback"
  | "incident"
  | "override"
  | "regression"
  | "latency_spike"
  | "human_intervention"
  | "unknown";

export interface OutcomeRecorded {
  outcome_id: string;
  attaches_to: { trajectory_id?: string; command_id?: string };
  kind: OutcomeKind;
  severity: 0 | 1 | 2 | 3 | 4 | 5;
  metrics: Record<string, number>;
  notes?: string;
  refs: TrajectoryRefs;
  timestamp: string;
  schema_version: number;
}

const REQUIRED: (keyof OutcomeRecorded)[] = [
  "outcome_id",
  "attaches_to",
  "kind",
  "severity",
  "metrics",
  "refs",
  "timestamp",
  "schema_version",
];

export function validateOutcome(
  candidate: Partial<OutcomeRecorded>,
): OutcomeRecorded {
  for (const field of REQUIRED) {
    if (candidate[field] === undefined) {
      throw new ValidationError(`Missing outcome field: ${field}`);
    }
  }
  if (
    !candidate.attaches_to?.trajectory_id &&
    !candidate.attaches_to?.command_id
  ) {
    throw new ValidationError(
      "Outcome must attach to a trajectory_id or command_id",
    );
  }
  if (candidate.severity! < 0 || candidate.severity! > 5) {
    throw new ValidationError("Outcome severity must be between 0 and 5");
  }
  if (typeof candidate.metrics !== "object") {
    throw new ValidationError("Outcome metrics required");
  }
  return candidate as OutcomeRecorded;
}

export function buildOutcome(input: {
  outcome_id: string;
  attaches_to: { trajectory_id?: string; command_id?: string };
  kind: OutcomeKind;
  severity: 0 | 1 | 2 | 3 | 4 | 5;
  metrics: Record<string, number>;
  notes?: string;
  refs: TrajectoryRefs;
  timestamp: string;
}): OutcomeRecorded {
  return validateOutcome({
    ...input,
    schema_version: OUTCOME_SCHEMA_VERSION,
  });
}
