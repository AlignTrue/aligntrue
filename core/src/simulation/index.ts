export type {
  EvidenceEntry,
  ConfidenceBreakdown,
  SimulationResult,
  FeatureNameV1,
} from "./types.js";
export { FEATURE_SCHEMA_V1 } from "./types.js";

export {
  blastRadius,
  type BlastRadiusQuery,
  type BlastRadiusResult,
} from "./blast-radius.js";
export {
  similarTrajectories,
  type SimilarTrajectoriesQuery,
  type SimilarTrajectoriesResult,
} from "./similar-trajectories.js";
export {
  simulateChange,
  type ChangeSimulationQuery,
  type ChangeSimulationResult,
} from "./change-simulation.js";
export { createSimulationEngine, type SimulationEngine } from "./engine.js";
