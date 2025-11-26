/**
 * Conformance test vector types for Align Spec v1
 */

/**
 * Canonicalization test vector
 *
 * Tests that input → JCS → SHA-256 produces expected outputs.
 */
export interface CanonVector {
  /** Unique name for this test case */
  name: string;
  /** Human-readable description of what this tests */
  description: string;
  /** Input value (any JSON-serializable value) */
  input: unknown;
  /** Expected JCS (RFC 8785) canonical JSON string */
  expected_jcs: string;
  /** Expected SHA-256 hash (hex) of the JCS output */
  expected_sha256: string;
}

/**
 * Check runner test vector
 *
 * Tests that a rule applied to a virtual file tree produces expected findings.
 */
export interface CheckVector {
  /** Unique name for this test case */
  name: string;
  /** Human-readable description of what this tests */
  description: string;
  /** Check type being tested */
  check_type:
    | "file_presence"
    | "path_convention"
    | "manifest_policy"
    | "regex"
    | "command_runner";
  /** Complete rule from Align spec */
  rule: Rule;
  /** Virtual file system: path → content */
  file_tree: Record<string, string>;
  /** Expected findings (empty array if rule passes) */
  expected_findings: Finding[];
  /** Whether command execution is allowed (for command_runner checks) */
  allow_exec?: boolean;
}

/**
 * Integration test vector referencing production aligns
 */
export interface IntegrationVector {
  /** Align identifier */
  id: string;
  /** Repository URL */
  repo: string;
  /** Path within repository */
  path: string;
  /** Expected integrity hash */
  expected_integrity: string;
}

/**
 * Rule structure from Align Spec v1
 */
export interface Rule {
  id: string;
  severity: "MUST" | "SHOULD" | "MAY";
  check: Check;
  autofix?: {
    hint: string;
  };
}

/**
 * Check structure from Align Spec v1
 */
export interface Check {
  type:
    | "file_presence"
    | "path_convention"
    | "manifest_policy"
    | "regex"
    | "command_runner";
  inputs: Record<string, unknown>;
  evidence: string;
}

/**
 * Finding structure (matches packages/checks output)
 */
export interface Finding {
  rule_id: string;
  severity: "MUST" | "SHOULD" | "MAY";
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

/**
 * Test results for a vector suite
 */
export interface VectorResults {
  total: number;
  passed: number;
  failed: number;
  failures: VectorFailure[];
}

/**
 * Individual vector failure
 */
export interface VectorFailure {
  vector_name: string;
  reason: string;
  expected?: unknown;
  actual?: unknown;
}
