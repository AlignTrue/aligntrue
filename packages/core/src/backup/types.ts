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
  /** Action that triggered this backup (e.g., 'team-enable-migration') */
  action?: string;
  /** Mode at time of backup */
  mode?: "solo" | "team" | "enterprise";
  /** Scope information at time of backup */
  scopes?: Record<string, { sections: number; storage: string }>;
  /** Agent files backed up (relative paths from workspace root) */
  agent_files?: string[];
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
  /** Action that triggered this backup */
  action?: string;
  /** Mode at time of backup */
  mode?: "solo" | "team" | "enterprise";
  /** Scope information */
  scopes?: Record<string, { sections: number; storage: string }>;
  /** Include agent files in backup (default: true) */
  includeAgentFiles?: boolean;
  /** File patterns to determine which agent files to back up */
  agentFilePatterns?: string | string[] | null;
}

export interface RestoreOptions {
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Specific timestamp to restore, or undefined for most recent */
  timestamp?: string;
  /** Specific files to restore (if undefined, restores all files) */
  files?: string[];
}

export interface CleanupOptions {
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;
  /** DEPRECATED: Use retentionDays instead. Number of backups to keep (default: 20) */
  keepCount?: number;
  /** Age-based retention in days (0 = manual only, default: 30) */
  retentionDays?: number;
  /** Safety floor: always keep at least N most recent backups (default: 3) */
  minimumKeep?: number;
}
