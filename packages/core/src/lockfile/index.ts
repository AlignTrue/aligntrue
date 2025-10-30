/**
 * Lockfile system with hash-based drift detection
 *
 * Supports three modes:
 * - off: No validation (solo mode default)
 * - soft: Warn on mismatch, continue sync (team mode default)
 * - strict: Error on mismatch, abort sync
 */

export type {
  Lockfile,
  LockfileEntry,
  LockfileMode,
  Mismatch,
  ValidationResult,
  EnforcementResult,
} from "./types.js";

export { generateLockfile, hashRule } from "./generator.js";
export { validateLockfile, formatValidationResult } from "./validator.js";
export { enforceLockfile } from "./enforcer.js";
export { readLockfile, writeLockfile } from "./io.js";
