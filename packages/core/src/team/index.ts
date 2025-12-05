/**
 * Team mode module
 *
 * Provides drift detection and validation
 */

export * from "./types.js";
export * from "./validation.js";
export {
  detectDrift,
  detectDriftForConfig,
  detectLockfileDrift,
} from "./drift.js";
export {
  compareBundles,
  compareDetailedBundles,
  type BundleDiff,
  type DetailedBundleDiff,
  type DetailedSectionDiff,
} from "./bundle-diff.js";
