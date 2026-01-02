import type { EventEnvelope } from "../envelopes/index.js";

export interface ProjectionFreshness {
  last_event_id: string | null;
  last_ingested_at: string | null;
}

export interface ProjectionDefinition<TState> {
  readonly name: string;
  readonly version: string; // semver
  init(): TState;
  apply(state: TState, event: EventEnvelope): TState;
  getFreshness(state: TState): ProjectionFreshness;
}
