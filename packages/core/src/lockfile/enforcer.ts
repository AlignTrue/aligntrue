/**
 * Lockfile enforcement - simplified
 *
 * Validation is now simple: lockfile is on or off (via modules.lockfile).
 * Enforcement (blocking on drift) happens in CI via `aligntrue drift --gates`.
 * Sync always regenerates the lockfile; drift command validates it.
 */

import type {
  LockfileMode,
  LockfileValidationResult,
  EnforcementResult,
} from "./types.js";
import { formatValidationResult } from "./validator.js";

/**
 * Check lockfile validation result
 *
 * Returns a simple success/failure result. The caller decides how to handle it.
 * For drift detection, use `aligntrue drift --gates` in CI.
 *
 * @param validation - Validation result from validateLockfile
 * @returns EnforcementResult
 */
export function checkLockfileValidation(
  validation: LockfileValidationResult,
): EnforcementResult {
  if (validation.valid) {
    return {
      success: true,
      message: "Lockfile is up to date",
    };
  }

  return {
    success: false,
    message: formatValidationResult(validation),
  };
}

/**
 * @deprecated Use checkLockfileValidation instead. Mode-based enforcement removed.
 * Kept for backward compatibility - behavior now ignores mode parameter.
 */
export function enforceLockfile(
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  _mode: LockfileMode,
  validation: LockfileValidationResult,
): EnforcementResult {
  // Mode is now ignored - validation happens, caller decides what to do
  return checkLockfileValidation(validation);
}
