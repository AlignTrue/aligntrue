/**
 * Lockfile generation helpers
 * Shared logic for creating lockfiles when needed
 */

import { join } from "path";
import { generateLockfile, writeLockfile } from "@aligntrue/core/lockfile";
import { readFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import type { AlignTrueConfig } from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";

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

    // Load IR as AlignPack
    const irContent = readFileSync(irPath, "utf-8");
    const pack = parseYaml(irContent) as AlignPack;

    // Ensure pack has required fields
    if (!pack || typeof pack !== "object") {
      return {
        success: false,
        error: "Invalid IR format",
      };
    }

    // Generate lockfile
    const lockfile = generateLockfile(
      pack,
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
