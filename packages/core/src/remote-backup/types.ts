/**
 * Remote backup types for AlignTrue
 *
 * Supports pushing local rules to remote git repositories
 * with support for multiple backup destinations.
 */

import type {
  RemoteBackupConfig,
  RemoteBackupDestination,
  AdditionalBackupDestination,
} from "../config/types.js";

export type {
  RemoteBackupConfig,
  RemoteBackupDestination,
  AdditionalBackupDestination,
};

/**
 * Result of resolving which files go to which backup
 */
export interface FileAssignment {
  /** Backup ID (or "default" for default backup) */
  backupId: string;
  /** Files assigned to this backup (relative paths) */
  files: string[];
  /** Backup configuration */
  config: RemoteBackupDestination;
}

/**
 * Warning generated during file resolution
 */
export interface ResolutionWarning {
  type: "duplicate" | "orphan" | "source-backup-conflict";
  message: string;
  files?: string[];
  url?: string;
}

/**
 * Result of file resolution
 */
export interface FileResolutionResult {
  /** File assignments per backup */
  assignments: FileAssignment[];
  /** Warnings generated during resolution */
  warnings: ResolutionWarning[];
}

/**
 * Result of a backup push operation
 */
export interface BackupPushResult {
  /** Backup ID */
  backupId: string;
  /** Whether the push was successful */
  success: boolean;
  /** Number of files pushed */
  filesCount: number;
  /** Git commit SHA (if successful) */
  commitSha?: string;
  /** Error message (if failed) */
  error?: string;
  /** Whether this backup was skipped (e.g., source/backup conflict) */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Result of the entire backup operation
 */
export interface RemoteBackupResult {
  /** Results per backup destination */
  results: BackupPushResult[];
  /** Overall success (all backups succeeded or were skipped) */
  success: boolean;
  /** Total files backed up */
  totalFiles: number;
  /** Warnings generated */
  warnings: ResolutionWarning[];
}

/**
 * Options for remote backup operations
 */
export interface RemoteBackupOptions {
  /** Current working directory */
  cwd?: string;
  /** Dry run - don't actually push */
  dryRun?: boolean;
  /** Force push even if no changes detected */
  force?: boolean;
  /** Commit message for the backup */
  message?: string;
  /** Source URLs to check for conflicts */
  sourceUrls?: string[];
  /** Progress callback */
  onProgress?: ((message: string) => void) | undefined;
}

/**
 * Status of a remote backup
 */
export interface RemoteBackupStatus {
  /** Backup ID */
  backupId: string;
  /** Repository URL */
  url: string;
  /** Branch */
  branch: string;
  /** Files assigned to this backup */
  files: string[];
  /** Last push timestamp (if known) */
  lastPush?: string;
  /** Last commit SHA (if known) */
  lastCommit?: string;
  /** Whether this backup is configured but not yet pushed */
  neverPushed?: boolean;
}
