/**
 * Remotes types for AlignTrue
 *
 * Supports scope-based and pattern-based routing of rules to remote git repositories
 */

import type {
  RemotesConfig,
  RemoteDestination,
  CustomRemoteDestination,
} from "../config/types.js";

export type { RemotesConfig, RemoteDestination, CustomRemoteDestination };

/**
 * Rule scope type
 */
export type RuleScope = "team" | "personal" | "shared";

/**
 * File with scope information for routing
 */
export interface ScopedFile {
  /** Relative path to rule file */
  path: string;
  /** Rule scope from frontmatter */
  scope: RuleScope;
}

/**
 * Result of resolving which files go to which remote
 * Now supports multiple destinations per file (additive model)
 */
export interface FileAssignment {
  /** Remote ID (personal, shared, or custom id) */
  remoteId: string;
  /** Files assigned to this remote (relative paths) */
  files: string[];
  /** Remote configuration */
  config: RemoteDestination;
}

/**
 * Warning generated during file resolution
 */
export interface ResolutionWarning {
  type: "duplicate" | "orphan" | "source-backup-conflict" | "no-remote";
  message: string;
  files?: string[];
  url?: string;
}

/**
 * Unrouted file information for diagnostics
 */
export interface UnroutedFile {
  /** Relative path to rule file */
  path: string;
  /** Rule scope from frontmatter */
  scope: RuleScope;
  /** Reason file was not routed */
  reason: string;
}

/**
 * Diagnostics for file resolution (helps debug "no files to sync")
 */
export interface FileResolutionDiagnostics {
  /** Mode that was used for routing */
  mode: "solo" | "team" | "enterprise";
  /** Total rule files found */
  totalFiles: number;
  /** Number of files routed to remotes */
  routedFiles: number;
  /** Files that were not routed with reasons */
  unroutedFiles: UnroutedFile[];
}

/**
 * Result of file resolution
 */
export interface FileResolutionResult {
  /** File assignments per remote */
  assignments: FileAssignment[];
  /** Warnings generated during resolution */
  warnings: ResolutionWarning[];
  /** Diagnostics for debugging (why files weren't routed) */
  diagnostics?: FileResolutionDiagnostics;
}

/**
 * Result of a remote push operation
 */
export interface RemotePushResult {
  /** Remote ID */
  remoteId: string;
  /** Whether the push was successful */
  success: boolean;
  /** Number of files pushed */
  filesCount: number;
  /** Git commit SHA (if successful) */
  commitSha?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether this remote was skipped (e.g., source/backup conflict) */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Result of the entire remotes sync operation
 */
export interface RemotesSyncResult {
  /** Results per remote destination */
  results: RemotePushResult[];
  /** Overall success (all remotes succeeded or were skipped) */
  success: boolean;
  /** Total files synced */
  totalFiles: number;
  /** Warnings generated */
  warnings: ResolutionWarning[];
  /** Diagnostics for debugging (why files weren't routed) */
  diagnostics?: FileResolutionDiagnostics | undefined;
}

/**
 * Options for remotes operations
 */
export interface RemotesOptions {
  /** Current working directory */
  cwd?: string;
  /** Dry run - don't actually push */
  dryRun?: boolean;
  /** Force push even if no changes detected */
  force?: boolean;
  /** Commit message */
  message?: string;
  /** Source URLs to check for conflicts */
  sourceUrls?: string[];
  /** Progress callback */
  onProgress?: ((message: string) => void) | undefined;
}

/**
 * Status of a remote
 */
export interface RemoteStatus {
  /** Remote ID */
  remoteId: string;
  /** Repository URL */
  url: string;
  /** Branch */
  branch: string;
  /** Files assigned to this remote */
  files: string[];
  /** Last push timestamp (if known) */
  lastPush?: string;
  /** Last commit SHA (if known) */
  lastCommit?: string;
  /** Whether this remote is configured but not yet pushed */
  neverPushed?: boolean;
}
