/**
 * Lockfile types for hash-based drift detection (v2)
 *
 * Simplified to just bundle_hash - no per-rule tracking needed.
 * Git handles diffing, we just need to know if state changed.
 */

/**
 * Lockfile v2 - minimal format
 *
 * bundle_hash covers:
 * - All .aligntrue/rules/*.md file hashes (excluding scope: personal)
 * - .aligntrue/config.team.yaml hash
 */
export interface Lockfile {
  version: "1" | "2"; // Support both during migration
  bundle_hash: string; // SHA-256 of all team-managed content
}

/**
 * Legacy v1 lockfile format (for migration detection)
 */
export interface LockfileV1 {
  version: "1";
  generated_at: string;
  mode: "team" | "enterprise";
  rules: Array<{
    rule_id: string;
    content_hash: string;
    owner?: string;
    source?: string;
    source_sha?: string;
    base_hash?: string;
    overlay_hash?: string;
    result_hash?: string;
    pre_resolution_hash?: string;
    post_resolution_hash?: string;
    unresolved_plugs_count?: number;
  }>;
  bundle_hash: string;
  team_yaml_hash?: string;
  total_unresolved_plugs?: number;
  personal_rules_count?: number;
  is_initial?: boolean;
}

export type LockfileMode = "off" | "soft" | "strict";

/**
 * Simplified validation result - just checks bundle_hash
 */
export interface LockfileValidationResult {
  valid: boolean;
  expectedHash: string;
  actualHash: string;
}

export interface EnforcementResult {
  success: boolean;
  message?: string;
  exitCode: number; // 0 = success, 1 = failure
}

/**
 * Check if a lockfile is v1 format (needs migration)
 */
export function isV1Lockfile(
  lockfile: Lockfile | LockfileV1,
): lockfile is LockfileV1 {
  return "rules" in lockfile || "generated_at" in lockfile;
}
