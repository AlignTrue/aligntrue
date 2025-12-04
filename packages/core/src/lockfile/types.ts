/**
 * Lockfile types for hash-based drift detection
 */

export interface LockfileEntry {
  rule_id: string;
  content_hash: string; // SHA-256 of canonical IR (vendor.volatile excluded) - alias to result_hash
  // Full provenance tracking
  owner?: string;
  source?: string;
  source_sha?: string;
  // Triple-hash format for overlay tracking (Overlays system)
  // base_hash: Hash of upstream align (before overlays)
  // overlay_hash: Hash of overlay configuration (when overlays applied)
  // result_hash: Hash of final result (after overlays applied)
  base_hash?: string;
  overlay_hash?: string;
  result_hash?: string;
  // Plugs tracking (Plugs system)
  pre_resolution_hash?: string; // Hash before plug resolution (template)
  post_resolution_hash?: string; // Hash after plug resolution (with fills)
  unresolved_plugs_count?: number; // Count of unresolved required plugs
}

export interface Lockfile {
  version: "1";
  generated_at: string; // ISO 8601 timestamp
  mode: "team" | "enterprise";
  rules: LockfileEntry[];
  bundle_hash: string; // hash of all rule hashes combined
  /**
   * SHA-256 of .aligntrue.team.yaml at lockfile generation time
   * Used for detecting severity remapping drift (Team mode)
   */
  team_yaml_hash?: string;
  /**
   * Total count of unresolved required plugs across all aligns (Plugs system)
   */
  total_unresolved_plugs?: number;
  /**
   * Count of personal-scoped sections excluded from lockfile validation
   * Personal sections can change freely without triggering drift detection
   */
  personal_rules_count?: number;
}

export type LockfileMode = "off" | "soft" | "strict";

export interface Mismatch {
  rule_id: string;
  expected_hash: string;
  actual_hash: string;
  // Full provenance for context in errors
  owner?: string;
  source?: string;
  source_sha?: string;
  // Triple-hash comparison details (Overlays system)
  hash_type?: "base" | "overlay" | "result"; // Which hash mismatched
  base_hash?: string;
  overlay_hash?: string;
  result_hash?: string;
}

export interface LockfileValidationResult {
  valid: boolean;
  mismatches: Mismatch[];
  newRules: string[];
  deletedRules: string[];
}

export interface EnforcementResult {
  success: boolean;
  message?: string;
  exitCode: number; // 0 = success, 1 = failure
}
