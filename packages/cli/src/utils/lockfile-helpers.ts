/**
 * Lockfile generation helpers
 * Shared logic for creating lockfiles when needed
 */

import { join } from "path";
import { generateLockfile, writeLockfile } from "@aligntrue/core/lockfile";
import { loadRulesDirectory } from "@aligntrue/core";
import { existsSync, readFileSync } from "fs";
import type { AlignTrueConfig } from "@aligntrue/core";
import { computeHash } from "@aligntrue/schema";

export interface LockfileGenerationOptions {
  cwd: string;
  config: AlignTrueConfig;
  quiet?: boolean;
}

export interface LockfileGenerationResult {
  success: boolean;
  lockfilePath?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Generate lockfile if needed for team mode
 * Returns result indicating success, skip, or error
 */
export async function ensureLockfileExists(
  options: LockfileGenerationOptions,
): Promise<LockfileGenerationResult> {
  const { cwd, config, quiet = false } = options;

  // Only generate lockfile for team mode
  if (config.mode !== "team") {
    return {
      success: true,
      skipped: true,
      skipReason: "Not in team mode",
    };
  }

  const lockfilePath = join(cwd, ".aligntrue", "lock.json");

  // Skip if lockfile already exists
  if (existsSync(lockfilePath)) {
    return {
      success: true,
      lockfilePath,
      skipped: true,
      skipReason: "Lockfile already exists",
    };
  }

  // Generate lockfile
  try {
    // Find rules directory
    const rulesPath = join(cwd, ".aligntrue", "rules");
    if (!existsSync(rulesPath)) {
      return {
        success: false,
        error: "Rules directory not found. Run 'aligntrue sync' first.",
      };
    }

    // Load rule files
    const rules = await loadRulesDirectory(rulesPath, cwd);

    // Generate lockfile
    const lockfile = generateLockfile(rules, cwd);

    // Write lockfile
    writeLockfile(lockfilePath, lockfile);

    if (!quiet) {
      console.log(`✓ Generated lockfile: ${lockfilePath}`);
    }

    return {
      success: true,
      lockfilePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if lockfile generation is needed
 */
export function isLockfileNeeded(
  config: AlignTrueConfig,
  cwd: string,
): boolean {
  if (config.mode !== "team") {
    return false;
  }

  const lockfilePath = join(cwd, ".aligntrue", "lock.json");
  return !existsSync(lockfilePath);
}

/**
 * Get lockfile status message
 */
export function getLockfileStatusMessage(
  config: AlignTrueConfig,
  cwd: string,
): string | null {
  if (!isLockfileNeeded(config, cwd)) {
    return null;
  }

  return "⚠ Team mode requires a lockfile. Run 'aligntrue sync' to generate it.";
}

/**
 * Create an empty lockfile for team mode
 * Used when team mode is first enabled, before any rules exist
 */
export async function createEmptyLockfile(
  cwd: string,
  _mode: "team" | "enterprise",
): Promise<{ success: boolean; lockfilePath?: string; error?: string }> {
  const { join } = await import("path");
  const { writeLockfile } = await import("@aligntrue/core/lockfile");
  const lockfilePath = join(cwd, ".aligntrue", "lock.json");

  try {
    // Compute bundle hash consistent with generateLockfile: include team config hash (or empty-string hash if missing)
    const teamConfigPath = join(cwd, ".aligntrue", "config.team.yaml");
    const teamConfigHash = computeFileHash(teamConfigPath);

    // With no rules yet, bundle hash is based solely on team config hash
    const emptyBundleHash = computeHash(teamConfigHash);

    const emptyLockfile = {
      version: "2" as const,
      bundle_hash: emptyBundleHash,
    };

    writeLockfile(lockfilePath, emptyLockfile, { silent: true });

    return {
      success: true,
      lockfilePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Compute hash of a file's contents; returns hash of empty string if missing or unreadable.
 */
function computeFileHash(path: string): string {
  try {
    if (!existsSync(path)) {
      return computeHash("");
    }
    const content = readFileSync(path, "utf-8");
    return computeHash(content);
  } catch {
    return computeHash("");
  }
}
