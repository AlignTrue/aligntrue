/**
 * Team mode module
 *
 * Provides allow list management and validation for team-approved rule sources
 */

export * from "./types.js";
export * from "./allow.js";
export * from "./validation.js";
export { detectDrift, detectDriftForConfig } from "./drift.js";
export {
  parseTeamYaml,
  validateRemaps,
  hasValidTeamYaml,
  applySeverityRemap,
} from "./remap.js";
export {
  detectUpstreamUpdates,
  generateUpdateSummary,
  detectUpdatesForConfig,
  type UpdateFinding,
  type UpdateResult,
} from "./updates.js";
