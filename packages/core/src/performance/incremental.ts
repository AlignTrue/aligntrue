/**
 * Incremental validation support (foundation)
 *
 * Phase 3 Session 10: Performance optimization
 *
 * This is a foundation for incremental validation that can be expanded
 * as performance needs arise. Full git integration deferred.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface ValidationState {
  timestamp: string;
  lastCommit: string | null;
  validatedFiles: string[];
  configHash: string;
}

/**
 * Load validation state from cache
 *
 * Returns null if no state file exists
 */
export function loadValidationState(cacheDir: string): ValidationState | null {
  const statePath = join(cacheDir, "validation-state.json");

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save validation state to cache
 */
export function saveValidationState(
  cacheDir: string,
  state: ValidationState,
): void {
  const statePath = join(cacheDir, "validation-state.json");
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Detect changed files since last validation
 *
 * TODO: Full git integration deferred until performance data shows need
 * For now, returns empty array (triggers full validation)
 *
 * Future implementation:
 * - Run `git diff --name-only <lastCommit>` to get changed files
 * - Filter by include/exclude patterns from config
 * - Return list of files needing revalidation
 */
export function detectChangedFiles(since: string): string[] {
  // TODO: Implement git diff detection
  // For now, return empty (will trigger full validation)
  return [];
}

/**
 * Check if incremental validation should be used
 *
 * Incremental validation is skipped if:
 * - No validation state exists
 * - Config hash changed
 * - Force flag set
 * - No git repository
 */
export function shouldUseIncremental(
  state: ValidationState | null,
  currentConfigHash: string,
  force: boolean,
): boolean {
  if (force) {
    return false;
  }

  if (!state) {
    return false;
  }

  if (state.configHash !== currentConfigHash) {
    return false;
  }

  // TODO: Check if git repository exists
  // For now, return false (always do full validation)
  return false;
}
