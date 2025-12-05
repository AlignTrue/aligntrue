import { existsSync } from "fs";
import { resolve } from "path";
import type { AlignTrueConfig } from "@aligntrue/core";
import {
  generateLockfile,
  loadRulesDirectory,
  readLockfile,
  validateLockfile,
} from "@aligntrue/core";

export type LockfileStatus =
  | "skipped"
  | "missing"
  | "valid"
  | "mismatch"
  | "read_error";

export interface LockfileValidationResult {
  status: LockfileStatus;
  lockfilePath?: string;
  expectedHash?: string;
  actualHash?: string;
  error?: string;
}

/**
 * Validate lockfile for team mode.
 * Returns structured result for CLI formatting.
 */
export async function validateLockfileForCheck(
  config: AlignTrueConfig,
  cwd: string,
): Promise<LockfileValidationResult> {
  const shouldCheckLockfile =
    config.mode === "team" && config.modules?.lockfile === true;

  if (!shouldCheckLockfile) {
    return { status: "skipped" };
  }

  const lockfilePath = resolve(cwd, ".aligntrue", "lock.json");

  if (!existsSync(lockfilePath)) {
    return { status: "missing", lockfilePath };
  }

  try {
    const lockfile = readLockfile(lockfilePath);
    if (!lockfile) {
      return {
        status: "read_error",
        lockfilePath,
        error: "Failed to read lockfile",
      };
    }

    // Compute current bundle hash from rules
    const rulesPath = resolve(cwd, ".aligntrue", "rules");
    const rules = await loadRulesDirectory(rulesPath, cwd);
    const currentLockfile = generateLockfile(rules, cwd);
    const validation = validateLockfile(lockfile, currentLockfile.bundle_hash);

    if (!validation.valid) {
      return {
        status: "mismatch",
        lockfilePath,
        expectedHash: validation.expectedHash,
        actualHash: validation.actualHash,
      };
    }

    return { status: "valid", lockfilePath };
  } catch (error) {
    return {
      status: "read_error",
      lockfilePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
