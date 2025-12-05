/**
 * Lockfile management logic for SyncEngine (v2)
 * Handles generation of lockfiles. Validation is done via `aligntrue drift`.
 */

import { resolve } from "path";
import type { AlignTrueConfig } from "../config/index.js";
import type { AuditEntry, OperationResult } from "./engine.js";
import {
  readLockfile,
  writeLockfile,
  validateLockfile,
  generateLockfile,
} from "../lockfile/index.js";
import type { RuleFile } from "../rules/file-io.js";

/**
 * Result of a lockfile validation operation
 * (Tracks operation success, not data validity)
 */
export interface LockfileOperationResult extends Partial<OperationResult> {
  success: boolean;
  auditTrail: AuditEntry[];
  warnings: string[];
}

/**
 * Result of a lockfile write operation
 */
export interface LockfileWriteResult extends Partial<OperationResult> {
  written: string[];
  auditTrail: AuditEntry[];
  warnings: string[];
}

/**
 * Check lockfile state (non-blocking, for audit trail)
 *
 * Note: This no longer enforces or blocks sync. Enforcement happens via
 * `aligntrue drift --gates` in CI. Sync always regenerates the lockfile.
 */
export function validateAndEnforceLockfile(
  rules: RuleFile[],
  config: AlignTrueConfig,
  cwd: string,
): LockfileOperationResult {
  const auditTrail: AuditEntry[] = [];
  const warnings: string[] = [];
  const lockfilePath = resolve(cwd, ".aligntrue", "lock.json");
  const isTeamMode = config.mode === "team" || config.mode === "enterprise";

  if (!isTeamMode || !config.modules?.lockfile) {
    return { success: true, auditTrail, warnings };
  }

  const existingLockfile = readLockfile(lockfilePath);

  if (existingLockfile) {
    // Generate current lockfile to get bundle_hash for comparison
    const currentLockfile = generateLockfile(rules, cwd);
    const validation = validateLockfile(
      existingLockfile,
      currentLockfile.bundle_hash,
    );

    // Audit trail: Lockfile validation (informational only)
    auditTrail.push({
      action: validation.valid ? "update" : "conflict",
      target: lockfilePath,
      source: "lockfile",
      timestamp: new Date().toISOString(),
      details: validation.valid
        ? "Lockfile is up to date"
        : "Lockfile drift detected (will be updated)",
    });
  } else {
    // No lockfile exists - will be generated after sync
    auditTrail.push({
      action: "create",
      target: lockfilePath,
      source: "lockfile",
      timestamp: new Date().toISOString(),
      details: "No existing lockfile found, will generate after sync",
    });
  }

  // Always succeed - sync never blocks on lockfile drift anymore
  return { success: true, auditTrail, warnings };
}

/**
 * Generate and write lockfile
 */
export function generateAndWriteLockfile(
  rules: RuleFile[],
  config: AlignTrueConfig,
  cwd: string,
  dryRun: boolean,
): LockfileWriteResult {
  const auditTrail: AuditEntry[] = [];
  const warnings: string[] = [];
  const written: string[] = [];
  const lockfilePath = resolve(cwd, ".aligntrue", "lock.json");
  const isTeamMode = config.mode === "team" || config.mode === "enterprise";

  if (!isTeamMode || !config.modules?.lockfile || dryRun) {
    return { written, auditTrail, warnings };
  }

  try {
    const lockfile = generateLockfile(rules, cwd);

    // Validate lockfile path is absolute
    const absoluteLockfilePath = lockfilePath.startsWith("/")
      ? lockfilePath
      : resolve(cwd, lockfilePath);

    writeLockfile(absoluteLockfilePath, lockfile);
    written.push(absoluteLockfilePath);

    // Audit trail: Lockfile generated
    auditTrail.push({
      action: "update",
      target: absoluteLockfilePath,
      source: "lockfile",
      hash: lockfile.bundle_hash,
      timestamp: new Date().toISOString(),
      details: `Generated lockfile v2 with bundle hash`,
    });
  } catch (_err) {
    const errorMsg = _err instanceof Error ? _err.message : String(_err);
    warnings.push(
      `Failed to generate lockfile at ${lockfilePath}: ${errorMsg}`,
    );
  }

  return { written, auditTrail, warnings };
}
