/**
 * Lockfile management logic for SyncEngine
 * Handles validation, enforcement, and generation of lockfiles
 */

import { resolve } from "path";
import type { AlignPack } from "@aligntrue/schema";
import type { AlignTrueConfig } from "../config/index.js";
import type { AuditEntry, OperationResult } from "./engine.js";
import {
  readLockfile,
  writeLockfile,
  validateLockfile,
  enforceLockfile,
  generateLockfile,
} from "../lockfile/index.js";

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
 * Validate and enforce lockfile state
 */
export function validateAndEnforceLockfile(
  ir: AlignPack,
  config: AlignTrueConfig,
  cwd: string,
): LockfileOperationResult {
  const auditTrail: AuditEntry[] = [];
  const warnings: string[] = [];
  const lockfilePath = resolve(cwd, ".aligntrue.lock.json");
  const lockfileMode = config.lockfile?.mode || "off";
  const isTeamMode = config.mode === "team" || config.mode === "enterprise";

  if (!isTeamMode || !config.modules?.lockfile) {
    return { success: true, auditTrail, warnings };
  }

  const existingLockfile = readLockfile(lockfilePath);

  if (existingLockfile) {
    // Validate lockfile against current IR
    const validation = validateLockfile(existingLockfile, ir);
    const enforcement = enforceLockfile(lockfileMode, validation);

    // Audit trail: Lockfile validation
    auditTrail.push({
      action: validation.valid ? "update" : "conflict",
      target: lockfilePath,
      source: "lockfile",
      timestamp: new Date().toISOString(),
      details: enforcement.message || "Lockfile validation completed",
    });

    // Abort sync if strict mode failed
    if (!enforcement.success) {
      return {
        success: false,
        auditTrail,
        warnings: [
          enforcement.message || "Lockfile validation failed in strict mode",
        ],
      };
    }
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

  return { success: true, auditTrail, warnings };
}

/**
 * Generate and write lockfile
 */
export function generateAndWriteLockfile(
  ir: AlignPack,
  config: AlignTrueConfig,
  cwd: string,
  dryRun: boolean,
): LockfileWriteResult {
  const auditTrail: AuditEntry[] = [];
  const warnings: string[] = [];
  const written: string[] = [];
  const lockfilePath = resolve(cwd, ".aligntrue.lock.json");
  const isTeamMode = config.mode === "team" || config.mode === "enterprise";

  if (!isTeamMode || !config.modules?.lockfile || dryRun) {
    return { written, auditTrail, warnings };
  }

  try {
    const lockfile = generateLockfile(ir, config.mode as "team" | "enterprise");

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
      details: `Generated lockfile with ${lockfile.rules?.length || 0} entry hashes`,
    });
  } catch (_err) {
    const errorMsg = _err instanceof Error ? _err.message : String(_err);
    warnings.push(
      `Failed to generate lockfile at ${lockfilePath}: ${errorMsg}`,
    );
  }

  return { written, auditTrail, warnings };
}
