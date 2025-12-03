/**
 * Lockfile validator with mismatch detection (simplified - no allow list)
 */

import type { Align } from "@aligntrue/schema";
import type { Lockfile, LockfileValidationResult, Mismatch } from "./types.js";
import { hashSection } from "./generator.js";
import type { RuleFile } from "../rules/file-io.js";

/**
 * Validate lockfile against current bundle
 *
 * Compares per-section hashes and detects:
 * - Modified sections (hash mismatch)
 * - New sections (in bundle but not in lockfile)
 * - Deleted sections (in lockfile but not in bundle)
 *
 * @param lockfile - Existing lockfile
 * @param currentAlign - Current Align to validate against
 * @returns LockfileValidationResult with detailed diff information
 */
export function validateLockfile(
  lockfile: Lockfile,
  currentAlign: Align,
): LockfileValidationResult {
  const mismatches: Mismatch[] = [];
  const newRules: string[] = [];
  const deletedRules: string[] = [];

  // Build maps for efficient lookup
  const lockfileMap = new Map(
    lockfile.rules.map((entry) => [entry.rule_id, entry]),
  );

  // Filter to tracked sections (team and shared are validated, personal is skipped)
  const trackedSections = currentAlign.sections.filter(
    (section) => section.scope !== "personal",
  );

  // Validate section-based align using fingerprints
  const currentSectionIds = new Set(trackedSections.map((s) => s.fingerprint));

  // Check for mismatches and new sections (only for tracked sections)
  for (const section of trackedSections) {
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
 * Compute fingerprint from a RuleFile
 * Matches the logic in ir-loader.ts and source-resolver.ts
 * Uses frontmatter.id if specified, otherwise filename without .md extension
 */
function computeRuleFingerprint(rule: RuleFile): string {
  const frontmatter = rule.frontmatter as Record<string, unknown>;
  return (frontmatter["id"] as string) || rule.filename.replace(/\.md$/, "");
}

/**
 * Validate lockfile against current rules
 * @param lockfile Existing lockfile
 * @param rules Current rule files
 */
export function validateLockfileFromRules(
  lockfile: Lockfile,
  rules: RuleFile[],
): LockfileValidationResult {
  const mismatches: Mismatch[] = [];
  const newRules: string[] = [];
  const deletedRules: string[] = [];

  const lockfileMap = new Map(
    lockfile.rules.map((entry) => [entry.rule_id, entry]),
  );

  // Filter logic if needed (e.g. ignore personal rules? Global rules?)
  // For now assume all passed rules should be in lockfile (except global, handled by caller)

  // Use fingerprints (matching ir-loader.ts and source-resolver.ts) for comparison
  const currentRuleIds = new Set(rules.map((r) => computeRuleFingerprint(r)));

  for (const rule of rules) {
    const fingerprint = computeRuleFingerprint(rule);
    const lockfileEntry = lockfileMap.get(fingerprint);

    if (!lockfileEntry) {
      newRules.push(fingerprint);
    } else {
      if (rule.hash !== lockfileEntry.content_hash) {
        mismatches.push({
          rule_id: fingerprint,
          expected_hash: lockfileEntry.content_hash,
          actual_hash: rule.hash,
        });
      }
    }
  }

  for (const entry of lockfile.rules) {
    if (!currentRuleIds.has(entry.rule_id)) {
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
 * @param currentAlign - Optional current align for enhanced rename detection
 */
export function formatValidationResult(
  result: LockfileValidationResult,
  _currentAlign?: Align,
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
 * Validate lockfile for team mode
 *
 * Returns all validation errors.
 */
export function validateLockfileTeamMode(
  _lockfile: Lockfile,
  mode: "solo" | "team" | "enterprise",
): LockfileTeamValidationResult {
  // Only validate in team mode
  if (mode !== "team") {
    return {
      valid: true,
      errors: [],
    };
  }

  // Validation is now handled via git PR review
  return {
    valid: true,
    errors: [],
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
