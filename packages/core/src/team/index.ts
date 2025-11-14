/**
 * Team mode module (simplified - removed allow list)
 *
 * Provides validation for team-approved rule sources via git PR review
 */

export * from "./types.js";
// export * from "./allow.js"; // DEPRECATED: removed
export * from "./validation.js";
export { detectDrift, detectDriftForConfig } from "./drift.js";
export {
  parseTeamYaml,
  validateRemaps,
  hasValidTeamYaml,
  applySeverityRemap,
} from "./remap.js";
export {
  // detectUpstreamUpdates, // DEPRECATED: removed
  generateUpdateSummary,
  detectUpdatesForConfig,
  type UpdateFinding,
  type UpdateResult,
} from "./updates.js";
export {
  compareBundles,
  compareDetailedBundles,
  type BundleDiff,
  type DetailedBundleDiff,
  type DetailedSectionDiff,
} from "./bundle-diff.js";
