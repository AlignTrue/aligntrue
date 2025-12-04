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
 * Result of file resolution
 */
export interface FileResolutionResult {
  /** File assignments per remote */
  assignments: FileAssignment[];
  /** Warnings generated during resolution */
  warnings: ResolutionWarning[];
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
