/**
 * Lockfile system with hash-based drift detection (v2)
 *
 * Lockfile is enabled via modules.lockfile: true in team mode.
 * Drift enforcement happens in CI via `aligntrue drift --gates`.
 *
 * v2 simplification: Just bundle_hash, no per-rule tracking.
 */

export type {
  Lockfile,
  LockfileV1,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  LockfileMode,
  LockfileValidationResult,
  EnforcementResult,
} from "./types.js";

export { isV1Lockfile } from "./types.js";

export { generateLockfile } from "./generator.js";
export { validateLockfile, formatValidationResult } from "./validator.js";
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { checkLockfileValidation, enforceLockfile } from "./enforcer.js";
export { readLockfile, writeLockfile } from "./io.js";
