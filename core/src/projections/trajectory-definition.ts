import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";

export interface TrajectoryProjectionFreshness {
  last_trajectory_id: string | null;
  last_step_id: string | null;
  last_outcome_id: string | null;
  rebuilt_at: string;
}

export interface TrajectoryProjectionDefinition<TState> {
  readonly name: string;
  readonly version: string; // semver
  init(): TState;
  applyStep(state: TState, step: TrajectoryEvent): TState;
  applyOutcome(state: TState, outcome: OutcomeRecorded): TState;
  getFreshness(state: TState): TrajectoryProjectionFreshness;
}

export interface TrajectoryProjectionOutput<T> {
  name: string;
  version: string;
  data: T;
  freshness: TrajectoryProjectionFreshness;
  hash: string;
}
