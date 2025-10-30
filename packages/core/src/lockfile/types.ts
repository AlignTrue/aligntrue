/**
 * Lockfile types for hash-based drift detection
 */

export interface LockfileEntry {
  rule_id: string;
  content_hash: string; // SHA-256 of canonical IR (vendor.volatile excluded)
  // Full provenance tracking
  owner?: string;
  source?: string;
  source_sha?: string;
  // Phase 3.5: Optional base pack hash for overlay resolution
  // Captured from git sources (commit SHA) when available
  // TODO(Phase 4): Capture from catalog sources when ready
  base_hash?: string;
  // Vendoring provenance (Phase 3, Session 5)
  vendor_path?: string; // Path where pack is vendored
  vendor_type?: "submodule" | "subtree" | "manual"; // Git vendoring method
  // Plugs tracking (Phase 2.5)
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
   * Used for detecting severity remapping drift (Phase 3, Session 7)
   */
  team_yaml_hash?: string;
  /**
   * Total count of unresolved required plugs across all packs (Phase 2.5)
   */
  total_unresolved_plugs?: number;
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
}

export interface ValidationResult {
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
