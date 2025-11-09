/**
 * Team mode types for allow list management
 */

/**
 * Source format in allow list
 * - type: 'id' for id@profile@version format, 'hash' for raw sha256:... format
 * - value: The source identifier (e.g., "base-global@org/repo@v1.0.0" or "sha256:abc...")
 * - resolved_hash: Computed hash for 'id' type sources (optional, populated on resolution)
 * - comment: Optional human-readable description
 */
export interface AllowListSource {
  type: "id" | "hash";
  value: string;
  resolved_hash?: string;
  comment?: string;
}

/**
 * Allow list file structure (.aligntrue/allow.yaml)
 */
export interface AllowList {
  version: 1;
  sources: AllowListSource[];
}

/**
 * Result of resolving a source to its concrete hash
 */
export interface SourceResolutionResult {
  success: boolean;
  source: string;
  hash?: string;
  error?: string;
}

/**
 * Validation result for allow list
 */
export interface AllowListValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Parsed source identifier components
 */
export interface ParsedSourceId {
  id: string;
  profile: string;
  version: string;
}

/**
 * Severity remapping types (from remap.ts)
 */
export type {
  AlignSeverity,
  CheckSeverity,
  SeverityRemap,
  TeamYaml,
  RemapValidationError,
} from "./remap.js";
