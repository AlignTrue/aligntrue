/**
 * Backup metadata and types for AlignTrue backup system
 */

export interface BackupMetadata {
  /** ISO 8601 timestamp when backup was created */
  timestamp: string;
  /** List of files backed up from .aligntrue/ directory */
  files: string[];
  /** Command that triggered backup creation (e.g., 'sync', 'manual') */
  created_by: string;
  /** Optional user-provided notes about the backup */
  notes?: string;
}

export interface BackupManifest extends BackupMetadata {
  /** Version of backup format (for future compatibility) */
  version: string;
}

export interface BackupInfo {
  /** Backup timestamp (directory name) */
  timestamp: string;
  /** Full path to backup directory */
  path: string;
  /** Parsed manifest data */
  manifest: BackupManifest;
}

export interface BackupOptions {
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Command creating the backup */
  created_by?: string;
  /** Optional notes */
  notes?: string;
}

export interface RestoreOptions {
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Specific timestamp to restore, or undefined for most recent */
  timestamp?: string;
}

export interface CleanupOptions {
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Number of backups to keep (default: 10) */
  keepCount?: number;
}
