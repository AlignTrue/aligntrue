/**
 * Lockfile generation helpers
 * Shared logic for creating lockfiles when needed
 */

import { join } from "path";
import { generateLockfile, writeLockfile } from "@aligntrue/core/lockfile";
import { loadIR } from "@aligntrue/core";
import { existsSync } from "fs";
import type { AlignTrueConfig } from "@aligntrue/core";

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

  const lockfilePath = join(cwd, ".aligntrue.lock.json");

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
    const irPath = join(cwd, ".aligntrue", "rules");
    if (!existsSync(irPath)) {
      return {
        success: false,
        error: "Rules directory not found. Run 'aligntrue sync' first.",
      };
    }

    // Load IR using loadIR which handles both files and directories
    const align = await loadIR(irPath, { mode: config.mode });

    // Ensure align has required fields
    if (!align || typeof align !== "object") {
      return {
        success: false,
        error: "Invalid IR format",
      };
    }

    // Generate lockfile
    const lockfile = generateLockfile(
      align,
      config.mode as "team" | "enterprise",
    );

    // Write lockfile
    await writeLockfile(lockfilePath, lockfile);

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

  const lockfilePath = join(cwd, ".aligntrue.lock.json");
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
  mode: "team" | "enterprise",
): Promise<{ success: boolean; lockfilePath?: string; error?: string }> {
  const { join } = await import("path");
  const { writeLockfile } = await import("@aligntrue/core/lockfile");
  const { computeHash } = await import("@aligntrue/schema");
  const lockfilePath = join(cwd, ".aligntrue.lock.json");

  try {
    // Compute empty bundle hash (hash of empty string)
    const emptyBundleHash = computeHash("");

    const emptyLockfile = {
      version: "1" as const,
      generated_at: new Date().toISOString(),
      mode,
      rules: [],
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
