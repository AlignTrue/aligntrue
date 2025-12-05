/**
 * Lockfile system with hash-based drift detection (v2)
 *
 * Supports three modes:
 * - off: No validation (solo mode default)
 * - soft: Warn on mismatch, continue sync (team mode default)
 * - strict: Error on mismatch, abort sync
 *
 * v2 simplification: Just bundle_hash, no per-rule tracking.
 */

export type {
  Lockfile,
  LockfileV1,
  LockfileMode,
  LockfileValidationResult,
  EnforcementResult,
} from "./types.js";

export { isV1Lockfile } from "./types.js";

export { generateLockfile } from "./generator.js";
export { validateLockfile, formatValidationResult } from "./validator.js";
export { enforceLockfile } from "./enforcer.js";
export { readLockfile, writeLockfile } from "./io.js";
