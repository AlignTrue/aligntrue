import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { TrajectoryStepType } from "../trajectories/steps.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";

export interface TrajectoryFilters {
  entity_ref?: string | undefined;
  command_id?: string | undefined;
  time_after?: string | undefined;
  time_before?: string | undefined;
  step_types?: TrajectoryStepType[] | undefined;
}

export interface TrajectoryListOptions {
  filters: TrajectoryFilters;
  limit?: number | undefined;
  cursor?: string | undefined;
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
