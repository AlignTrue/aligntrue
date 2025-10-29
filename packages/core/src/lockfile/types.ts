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
}

export interface Lockfile {
  version: "1";
  generated_at: string; // ISO 8601 timestamp
  mode: "team" | "enterprise";
  rules: LockfileEntry[];
  bundle_hash: string; // hash of all rule hashes combined
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
