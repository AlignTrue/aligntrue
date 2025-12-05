/**
 * Lockfile validator v2 - simplified bundle hash comparison
 *
 * Just compares bundle_hash - no per-rule tracking needed.
 * Git shows what changed, we just need to know IF it changed.
 */

import type { Lockfile, LockfileValidationResult } from "./types.js";

/**
 * Validate lockfile against current bundle hash
 *
 * Simply compares the bundle_hash values.
 * If they don't match, drift has occurred.
 *
 * @param lockfile - Existing lockfile
 * @param currentBundleHash - Current computed bundle hash
 * @returns LockfileValidationResult with hash comparison
 */
export function validateLockfile(
  lockfile: Lockfile,
  currentBundleHash: string,
): LockfileValidationResult {
  const valid = lockfile.bundle_hash === currentBundleHash;

  return {
    valid,
    expectedHash: lockfile.bundle_hash,
    actualHash: currentBundleHash,
  };
}

/**
 * Format validation result as human-readable message
 *
 * @param result - Validation result
 */
export function formatValidationResult(
  result: LockfileValidationResult,
): string {
  if (result.valid) {
    return "Lockfile is up to date";
  }

  const lines: string[] = [
    "Lockfile drift detected:",
    "",
    `  Expected: ${result.expectedHash.slice(0, 16)}...`,
    `  Actual:   ${result.actualHash.slice(0, 16)}...`,
    "",
    "Rules or team config have changed since the lockfile was generated.",
    "",
    "To fix:",
    "  1. Run 'aligntrue sync' to regenerate the lockfile",
    "  2. Commit the updated lockfile",
    "  3. Use 'git diff' to see what changed in rules/config",
  ];

  return lines.join("\n");
}
