import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { TrajectoryStepType } from "../trajectories/steps.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";

export interface TrajectoryFilters {
  entity_ref?: string;
  command_id?: string;
  time_after?: string;
  time_before?: string;
  step_types?: TrajectoryStepType[];
}

export interface TrajectoryListOptions {
  filters: TrajectoryFilters;
  limit?: number;
  cursor?: string;
  sort: "time_desc" | "time_asc";
}

export interface TrajectoryStore {
  appendStep(step: TrajectoryEvent): Promise<void>;
  readTrajectory(trajectory_id: string): Promise<TrajectoryEvent[]>;
  listTrajectories(opts: TrajectoryListOptions): Promise<{
    ids: string[];
    next_cursor?: string;
  }>;
  appendOutcome(outcome: OutcomeRecorded): Promise<void>;
  listOutcomes(opts: TrajectoryListOptions): Promise<{
    outcomes: OutcomeRecorded[];
    next_cursor?: string;
  }>;
}
