/**
 * Core types for the checks runner engine
 */

import type { AlignPack, AlignRule } from "@aligntrue/schema";

/**
 * Abstract file provider interface for testability
 */
export interface FileProvider {
  /**
   * Find files matching a glob pattern
   * @param pattern - Glob pattern (e.g., "**\/*.ts")
   * @param options - Optional glob options
   * @returns Array of matched file paths relative to working directory
   */
  glob(pattern: string, options?: GlobOptions): Promise<string[]>;

  /**
   * Read file contents as string
   * @param path - File path relative to working directory
   * @returns File contents
   */
  readFile(path: string): Promise<string>;

  /**
   * Check if a file exists
   * @param path - File path relative to working directory
   * @returns True if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Read and parse JSON file
   * @param path - File path relative to working directory
   * @returns Parsed JSON object
   */
  readJson(path: string): Promise<unknown>;
}

/**
 * Options for glob operations
 */
export interface GlobOptions {
  /**
   * Current working directory for glob resolution
   */
  cwd?: string;

  /**
   * Patterns to ignore
   */
  ignore?: string[];

  /**
   * Follow symbolic links
   */
  followSymlinks?: boolean;
}

/**
 * Location information for a finding
 */
export interface Location {
  /**
   * File path relative to working directory
   */
  path: string;

  /**
   * Optional line number (1-indexed)
   */
  line?: number;

  /**
   * Optional column number (1-indexed)
   */
  column?: number;

  /**
   * Optional end line for ranges
   */
  endLine?: number;

  /**
   * Optional end column for ranges
   */
  endColumn?: number;
}

/**
 * A single check finding (violation or issue)
 */
export interface Finding {
  /**
   * Pack ID this finding belongs to
   */
  packId: string;

  /**
   * Rule ID within the pack
   */
  ruleId: string;

  /**
   * Severity level from the rule (IR schema v1)
   */
  severity: "error" | "warn" | "info";

  /**
   * Evidence message from the check
   */
  evidence: string;

  /**
   * Human-readable message
   */
  message: string;

  /**
   * Location of the finding
   */
  location: Location;

  /**
   * Optional autofix hint
   */
  autofixHint?: string;
}

/**
 * Result of running a single check
 */
export interface CheckResult {
  /**
   * Rule that was checked
   */
  rule: AlignRule;

  /**
   * Pack ID
   */
  packId: string;

  /**
   * Whether the check passed
   */
  pass: boolean;

  /**
   * Findings if check failed
   */
  findings: Finding[];

  /**
   * Optional error if check couldn't run
   */
  error?: string;

  /**
   * Optional metadata (e.g., original severity before remapping)
   */
  metadata?: Record<string, unknown>;
}

/**
 * Execution configuration for command_runner checks
 */
export interface ExecutionConfig {
  /**
   * Allow actual command execution
   * Default: false (validation only)
   */
  allowExec: boolean;

  /**
   * Environment variables to pass to commands
   * Only these variables will be available
   */
  envWhitelist?: string[];

  /**
   * Default timeout in milliseconds
   */
  defaultTimeout?: number;
}

/**
 * Context passed to check runners
 */
export interface CheckContext {
  /**
   * File provider for accessing files
   */
  fileProvider: FileProvider;

  /**
   * Working directory for file operations
   */
  workingDir: string;

  /**
   * Execution configuration
   */
  executionConfig: ExecutionConfig;

  /**
   * Optional list of changed files (for incremental checks)
   */
  changedFiles?: string[];
}

/**
 * Options for running checks
 */
export interface RunChecksOptions {
  /**
   * File provider (defaults to DiskFileProvider)
   */
  fileProvider?: FileProvider;

  /**
   * Working directory (defaults to process.cwd())
   */
  workingDir?: string;

  /**
   * Allow command execution (default: false)
   */
  allowExec?: boolean;

  /**
   * Environment whitelist for command execution
   */
  envWhitelist?: string[];

  /**
   * Changed files for incremental checking
   */
  changedFiles?: string[];

  /**
   * Default command timeout in milliseconds
   */
  defaultTimeout?: number;

  /**
   * Mode (solo or team) - severity remapping only applies in team mode
   */
  mode?: "solo" | "team";

  /**
   * Path to .aligntrue.team.yaml file (defaults to .aligntrue.team.yaml in workingDir)
   */
  teamYamlPath?: string;
}

/**
 * Check runner function type
 */
export type CheckRunner = (
  rule: AlignRule,
  packId: string,
  context: CheckContext,
) => Promise<CheckResult>;

/**
 * Type guard to check if a rule has a check property
 * @param rule - Rule to check
 * @returns True if rule has a check property
 */
export function hasCheck(
  rule: AlignRule,
): rule is AlignRule & { check: NonNullable<AlignRule["check"]> } {
  return rule.check !== undefined && rule.check !== null;
}
