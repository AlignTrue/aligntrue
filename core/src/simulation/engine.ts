import type { CooccurrenceState } from "../projections/cooccurrence.js";
import type { TransitionState } from "../projections/transitions.js";
import type { SignatureState } from "../projections/signatures.js";
import type { OutcomeCorrelationState } from "../projections/outcome-correlations.js";
import {
  blastRadius,
  type BlastRadiusQuery,
  type BlastRadiusResult,
} from "./blast-radius.js";
import {
  similarTrajectories,
  type SimilarTrajectoriesQuery,
  type SimilarTrajectoriesResult,
} from "./similar-trajectories.js";
import {
  simulateChange,
  type ChangeSimulationQuery,
  type ChangeSimulationResult,
} from "./change-simulation.js";

export interface SimulationEngine {
  blastRadius(query: BlastRadiusQuery): Promise<BlastRadiusResult>;
  similarTrajectories(
    query: SimilarTrajectoriesQuery,
  ): Promise<SimilarTrajectoriesResult>;
  simulateChange(query: ChangeSimulationQuery): Promise<ChangeSimulationResult>;
}

export function createSimulationEngine(opts: {
  cooccurrence: CooccurrenceState;
  transitions: TransitionState;
  signatures: SignatureState;
  outcomeCorrelations: OutcomeCorrelationState;
}): SimulationEngine {
  return {
    async blastRadius(query) {
      return blastRadius(opts.cooccurrence, opts.outcomeCorrelations, query);
    },
    async similarTrajectories(query) {
      return similarTrajectories(opts.signatures, opts.cooccurrence, query);
    },
    async simulateChange(query) {
      return simulateChange(opts.transitions, opts.outcomeCorrelations, query);
    },
  };
}
