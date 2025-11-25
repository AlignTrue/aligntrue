/**
 * Team mode module
 *
 * Provides drift detection and validation
 */

export * from "./types.js";
export * from "./validation.js";
export { detectDrift, detectDriftForConfig } from "./drift.js";
export {
  parseTeamYaml,
  validateRemaps,
  hasValidTeamYaml,
  applySeverityRemap,
} from "./remap.js";
export {
  compareBundles,
  compareDetailedBundles,
  type BundleDiff,
  type DetailedBundleDiff,
  type DetailedSectionDiff,
} from "./bundle-diff.js";
