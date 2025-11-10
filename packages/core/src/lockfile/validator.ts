/**
 * Lockfile validator with mismatch detection and allow list integration
 */

import type { AlignPack } from "@aligntrue/schema";
import type { Lockfile, ValidationResult, Mismatch } from "./types.js";
import { hashSection } from "./generator.js";
import { existsSync } from "fs";
import { parseAllowList } from "../team/allow.js";

/**
 * Validate lockfile against current bundle
 *
 * Compares per-section hashes and detects:
 * - Modified sections (hash mismatch)
 * - New sections (in bundle but not in lockfile)
 * - Deleted sections (in lockfile but not in bundle)
 *
 * @param lockfile - Existing lockfile
 * @param currentPack - Current AlignPack to validate against
 * @returns ValidationResult with detailed diff information
 */
export function validateLockfile(
  lockfile: Lockfile,
  currentPack: AlignPack,
): ValidationResult {
  const mismatches: Mismatch[] = [];
  const newRules: string[] = [];
  const deletedRules: string[] = [];

  // Build maps for efficient lookup
  const lockfileMap = new Map(
    lockfile.rules.map((entry) => [entry.rule_id, entry]),
  );

  // Validate section-based pack using fingerprints
  const currentSectionIds = new Set(
    currentPack.sections.map((s) => s.fingerprint),
  );

  // Check for mismatches and new sections
  for (const section of currentPack.sections) {
    const lockfileEntry = lockfileMap.get(section.fingerprint);

    if (!lockfileEntry) {
      // New section not in lockfile
      newRules.push(section.fingerprint);
    } else {
      // Check if hash matches
      const currentHash = hashSection(section);
      if (currentHash !== lockfileEntry.content_hash) {
        mismatches.push({
          rule_id: section.fingerprint,
          expected_hash: lockfileEntry.content_hash,
          actual_hash: currentHash,
          // Include full provenance for context
          ...(lockfileEntry.owner && { owner: lockfileEntry.owner }),
          ...(lockfileEntry.source && { source: lockfileEntry.source }),
          ...(lockfileEntry.source_sha && {
            source_sha: lockfileEntry.source_sha,
          }),
        });
      }
    }
  }

  // Check for deleted sections
  for (const entry of lockfile.rules) {
    if (!currentSectionIds.has(entry.rule_id)) {
      deletedRules.push(entry.rule_id);
    }
  }

  const valid =
    mismatches.length === 0 &&
    newRules.length === 0 &&
    deletedRules.length === 0;

  return {
    valid,
    mismatches,
    newRules,
    deletedRules,
  };
}

/**
 * Format provenance fields for display
 */
function formatProvenance(mismatch: Mismatch): string {
  const parts: string[] = [];
  if (mismatch.owner) parts.push(`owner=${mismatch.owner}`);
  if (mismatch.source) parts.push(`source=${mismatch.source}`);
  if (mismatch.source_sha) parts.push(`sha=${mismatch.source_sha.slice(0, 7)}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

/**
 * Format validation result as human-readable message
 *
 * @param result - Validation result
 * @param currentPack - Optional current pack for enhanced rename detection
 */
export function formatValidationResult(
  result: ValidationResult,
  _currentPack?: AlignPack,
): string {
  if (result.valid) {
    return "Lockfile is up to date";
  }

  const lines: string[] = ["Lockfile validation failed:"];

  if (result.mismatches.length > 0) {
    lines.push(`\nModified rules (${result.mismatches.length}):`);
    for (const mismatch of result.mismatches) {
      lines.push(`  - ${mismatch.rule_id}`);
      lines.push(
        `    Expected: ${mismatch.expected_hash.slice(0, 12)}...${formatProvenance(mismatch)}`,
      );
      lines.push(`    Actual:   ${mismatch.actual_hash.slice(0, 12)}...`);
      if (formatProvenance(mismatch)) {
        lines.push(`    Rule content changed - review before proceeding`);
      }
    }
  }

  if (result.newRules.length > 0) {
    lines.push(`\nNew rules (${result.newRules.length}):`);
    for (const ruleId of result.newRules) {
      lines.push(`  + ${ruleId}`);
    }
    lines.push(`\nRun 'aligntrue sync' to update lockfile.`);
  }

  if (result.deletedRules.length > 0) {
    lines.push(`\nDeleted rules (${result.deletedRules.length}):`);
    for (const ruleId of result.deletedRules) {
      lines.push(`  - ${ruleId}`);
    }
    lines.push(`\nIf rules were renamed, add old IDs to 'aliases' array.`);
  }

  return lines.join("\n");
}

/**
 * Validation error for team mode lockfile checks
 */
export interface LockfileTeamValidationError {
  type: "error" | "warning";
  source?: string;
  message: string;
  suggestion: string;
}

/**
 * Team mode lockfile validation result
 */
export interface LockfileTeamValidationResult {
  valid: boolean;
  errors: LockfileTeamValidationError[];
}

/**
 * Validate lockfile sources against allow list (team mode only)
 *
 * Checks that all sources in lockfile are approved in allow list.
 * Only runs in team mode when allow list exists.
 */
export function validateAgainstAllowList(
  lockfile: Lockfile,
  mode: "solo" | "team" | "enterprise",
  allowListPath: string = ".aligntrue/allow.yaml",
): LockfileTeamValidationError[] {
  const errors: LockfileTeamValidationError[] = [];

  // Only validate in team mode
  if (mode !== "team") {
    return [];
  }

  // Check if allow list exists
  if (!existsSync(allowListPath)) {
    // If no allow list, give a warning but don't block
    return [
      {
        type: "warning",
        message: "No allow list configured",
        suggestion: `Run: aligntrue team approve <source>
  → Creates allow list for approved sources`,
      },
    ];
  }

  // Parse allow list
  let allowList;
  try {
    allowList = parseAllowList(allowListPath);
  } catch (_err) {
    return [
      {
        type: "error",
        message: "Failed to parse allow list",
        suggestion: `Check ${allowListPath} for syntax errors
  Error: ${_err instanceof Error ? _err.message : String(_err)}`,
      },
    ];
  }

  // If allow list is empty, warn
  if (allowList.sources.length === 0) {
    return [
      {
        type: "warning",
        message: "Allow list is empty",
        suggestion: `Run: aligntrue team approve <source>
  → Add approved sources to allow list`,
      },
    ];
  }

  // Check each lockfile entry has a source in allow list
  for (const entry of lockfile.rules) {
    // Skip entries without source (local rules)
    if (!entry.source) {
      continue;
    }

    // Check if source is in allow list
    const sourceInList = allowList.sources.some(
      (s) =>
        s.value === entry.source ||
        s.value.includes(entry.source || "") ||
        (entry.source || "").includes(s.value),
    );

    if (!sourceInList) {
      errors.push({
        type: "error",
        source: entry.source,
        message: `Lockfile source not in allow list: ${entry.source}`,
        suggestion: `Run: aligntrue team approve ${entry.source}
  → Or ask team lead to approve this source`,
      });
    }
  }

  return errors;
}

/**
 * Check for drift from allowed hash versions
 *
 * Compares lockfile hashes with expected hashes from allow list.
 * This is a foundation for Session 6 drift detection.
 */
export function checkDriftFromAllowedHashes(
  lockfile: Lockfile,
  mode: "solo" | "team" | "enterprise",
  allowListPath: string = ".aligntrue/allow.yaml",
): LockfileTeamValidationError[] {
  const errors: LockfileTeamValidationError[] = [];

  // Only validate in team mode
  if (mode !== "team") {
    return [];
  }

  // Check if allow list exists
  if (!existsSync(allowListPath)) {
    return [];
  }

  // Parse allow list
  let allowList;
  try {
    allowList = parseAllowList(allowListPath);
  } catch {
    // Already handled by validateAgainstAllowList
    return [];
  }

  // Check for drift (simplified for now - Session 6 will have full drift detection)
  // For now, just check if resolved_hash exists and matches
  for (const entry of lockfile.rules) {
    if (!entry.source) {
      continue;
    }

    // Find matching allow list entry
    const allowedSource = allowList.sources.find(
      (s) =>
        s.value === entry.source ||
        s.value.includes(entry.source || "") ||
        (entry.source || "").includes(s.value),
    );

    if (allowedSource && allowedSource.resolved_hash) {
      // Check if lockfile hash matches resolved hash
      if (entry.content_hash !== allowedSource.resolved_hash) {
        errors.push({
          type: "warning",
          source: entry.source,
          message: `Lockfile hash differs from allowed version`,
          suggestion: `Rule: ${entry.rule_id}
  Expected: ${allowedSource.resolved_hash.slice(0, 12)}...
  Actual:   ${entry.content_hash.slice(0, 12)}...
  → Run 'aligntrue drift' to see all drift (Session 6)
  → Run 'aligntrue sync --force' to accept changes`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate lockfile for team mode
 *
 * Combines allow list validation and drift detection.
 * Returns all validation errors.
 */
export function validateLockfileTeamMode(
  lockfile: Lockfile,
  mode: "solo" | "team" | "enterprise",
  allowListPath: string = ".aligntrue/allow.yaml",
): LockfileTeamValidationResult {
  // Only validate in team mode
  if (mode !== "team") {
    return {
      valid: true,
      errors: [],
    };
  }

  const errors: LockfileTeamValidationError[] = [];

  // Run all validation checks
  errors.push(...validateAgainstAllowList(lockfile, mode, allowListPath));
  errors.push(...checkDriftFromAllowedHashes(lockfile, mode, allowListPath));

  // Only actual errors block (not warnings)
  const hasErrors = errors.some((e) => e.type === "error");

  return {
    valid: !hasErrors,
    errors,
  };
}

/**
 * Format team mode validation errors for display
 */
export function formatLockfileTeamErrors(
  result: LockfileTeamValidationResult,
): string {
  if (result.valid && result.errors.length === 0) {
    return "Lockfile passes team mode validation";
  }

  const lines: string[] = [];
  const errors = result.errors.filter((e) => e.type === "error");
  const warnings = result.errors.filter((e) => e.type === "warning");

  if (errors.length > 0) {
    lines.push("Lockfile Team Mode Errors:");
    lines.push("");
    for (const error of errors) {
      lines.push(`ERROR: ${error.message}`);
      if (error.suggestion) {
        lines.push(`→ ${error.suggestion.replace(/\n/g, "\n  ")}`);
      }
      lines.push("");
    }
  }

  if (warnings.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Lockfile Team Mode Warnings:");
    lines.push("");
    for (const warning of warnings) {
      lines.push(`WARNING: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`→ ${warning.suggestion.replace(/\n/g, "\n  ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
