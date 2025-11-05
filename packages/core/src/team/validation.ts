/**
 * Team mode validation rules
 * Stricter validation for team workflows with enhanced error messages
 */

import { type AlignTrueConfig } from "../config/index.js";
import { existsSync } from "fs";
import { parseAllowList } from "./allow.js";

export interface TeamValidationError {
  type: "error" | "warning";
  message: string;
  suggestion: string;
  field?: string;
}

export interface TeamValidationResult {
  valid: boolean;
  errors: TeamValidationError[];
  warnings: TeamValidationError[];
}

/**
 * Validate team mode configuration
 * Checks that team mode requirements are met
 */
export function validateTeamConfig(
  config: AlignTrueConfig,
): TeamValidationError[] {
  const errors: TeamValidationError[] = [];

  // Team mode requires mode: team
  if (config.mode !== "team") {
    // Not an error, just not in team mode
    return [];
  }

  // Team mode should have lockfile enabled
  if (!config.modules?.lockfile) {
    errors.push({
      type: "warning",
      message: "Team mode without lockfile",
      suggestion: `Enable lockfile in .aligntrue/config.yaml:
  modules:
    lockfile: true`,
      field: "modules.lockfile",
    });
  }

  // If lockfile is enabled, mode should not be 'off'
  if (config.modules?.lockfile && config.lockfile?.mode === "off") {
    errors.push({
      type: "warning",
      message: "Lockfile enabled but mode is off",
      suggestion: `Set lockfile mode to soft or strict:
  lockfile:
    mode: soft  # or strict`,
      field: "lockfile.mode",
    });
  }

  return errors;
}

/**
 * Validate team lockfile exists and is valid
 */
export function validateTeamLockfile(
  config: AlignTrueConfig,
  lockfilePath: string = ".aligntrue.lock.json",
): TeamValidationError[] {
  const errors: TeamValidationError[] = [];

  // Only validate in team mode
  if (config.mode !== "team") {
    return [];
  }

  // If lockfile is disabled, skip
  if (!config.modules?.lockfile) {
    return [];
  }

  // Check if lockfile exists
  if (!existsSync(lockfilePath)) {
    errors.push({
      type: "warning",
      message: "Lockfile not generated yet",
      suggestion: `Run: aligntrue sync
  → Generates lockfile for reproducibility`,
      field: "lockfile",
    });
  }

  return errors;
}

/**
 * Validate team sources are in allow list
 */
export function validateTeamSources(
  config: AlignTrueConfig,
  allowListPath: string = ".aligntrue/allow.yaml",
): TeamValidationError[] {
  const errors: TeamValidationError[] = [];

  // Only validate in team mode
  if (config.mode !== "team") {
    return [];
  }

  // If no sources configured, nothing to validate
  if (!config.sources || config.sources.length === 0) {
    return [];
  }

  // Check if allow list exists
  if (!existsSync(allowListPath)) {
    errors.push({
      type: "warning",
      message: "Sources configured but no allow list",
      suggestion: `Run: aligntrue team approve <source>
  → Creates allow list for approved sources`,
      field: "sources",
    });
    return errors;
  }

  // Parse allow list
  try {
    const allowList = parseAllowList(allowListPath);

    // If allow list is empty, warn
    if (allowList.sources.length === 0) {
      errors.push({
        type: "warning",
        message: "Allow list exists but is empty",
        suggestion: `Run: aligntrue team approve <source>
  → Add approved sources to allow list`,
        field: "sources",
      });
      return errors;
    }

    // Check each source against allow list
    for (const source of config.sources) {
      // For git sources, check URL
      if (source.type === "git" && source.url) {
        const sourceUrl = source.url; // Extract to help TypeScript narrowing
        const urlInList = allowList.sources.some(
          (s) =>
            s.value === sourceUrl ||
            s.value.includes(sourceUrl) ||
            sourceUrl.includes(s.value),
        );
        if (!urlInList) {
          errors.push({
            type: "warning",
            message: `Source not in allow list: git:${sourceUrl}`,
            suggestion: `Run: aligntrue team approve git:${sourceUrl}`,
            field: "sources",
          });
        }
      }

      // Catalog sources no longer supported - removed in favor of git imports
    }
  } catch (_err) {
    errors.push({
      type: "error",
      message: "Failed to parse allow list",
      suggestion: `Check .aligntrue/allow.yaml for syntax errors
  Error: ${_err instanceof Error ? _err.message : String(_err)}`,
      field: "sources",
    });
  }

  return errors;
}

/**
 * Get all team validation errors
 * Aggregates all team validation checks
 */
export function getTeamValidationErrors(
  config: AlignTrueConfig,
  lockfilePath: string = ".aligntrue.lock.json",
  allowListPath: string = ".aligntrue/allow.yaml",
): TeamValidationResult {
  // Only validate in team mode
  if (config.mode !== "team") {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  const allErrors: TeamValidationError[] = [];

  // Run all validation checks
  allErrors.push(...validateTeamConfig(config));
  allErrors.push(...validateTeamLockfile(config, lockfilePath));
  allErrors.push(...validateTeamSources(config, allowListPath));

  // Separate errors and warnings
  const errors = allErrors.filter((e) => e.type === "error");
  const warnings = allErrors.filter((e) => e.type === "warning");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation errors for display
 */
export function formatTeamValidationErrors(
  result: TeamValidationResult,
): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push("Team Mode Validation Errors:");
    lines.push("");
    for (const error of result.errors) {
      lines.push(`ERROR: ${error.message}`);
      if (error.suggestion) {
        lines.push(`→ ${error.suggestion.replace(/\n/g, "\n  ")}`);
      }
      lines.push("");
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Team Mode Warnings:");
    lines.push("");
    for (const warning of result.warnings) {
      lines.push(`WARNING: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`→ ${warning.suggestion.replace(/\n/g, "\n  ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
