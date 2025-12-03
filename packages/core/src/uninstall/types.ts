/**
 * Types for the AlignTrue uninstall functionality
 */

/**
 * How to handle exported agent files during uninstall
 */
export type ExportHandling = "convert" | "delete" | "skip";

/**
 * How to handle source rules during uninstall
 */
export type SourceHandling = "keep" | "delete";

/**
 * Options for the uninstall operation
 */
export interface UninstallOptions {
  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;

  /** How to handle exported agent files */
  exportHandling: ExportHandling;

  /** How to handle source rules in .aligntrue/ */
  sourceHandling: SourceHandling;

  /** Preview changes without making them */
  dryRun?: boolean;

  /** Verbose output */
  verbose?: boolean;
}

/**
 * Information about a detected AlignTrue file
 */
export interface DetectedFile {
  /** Relative path from workspace root */
  path: string;

  /** Type of file */
  type: "export" | "config" | "source" | "lockfile" | "cache" | "backup";

  /** Whether file has READ-ONLY marker (exports only) */
  hasReadOnlyMarker?: boolean;

  /** File size in bytes */
  size: number;
}

/**
 * Result of detecting AlignTrue files in a workspace
 */
export interface DetectionResult {
  /** Whether AlignTrue is installed in this workspace */
  isInstalled: boolean;

  /** Path to .aligntrue/ directory */
  aligntrueDir: string | null;

  /** Exported agent files */
  exportedFiles: DetectedFile[];

  /** Source rule files */
  sourceFiles: DetectedFile[];

  /** Configuration files */
  configFiles: DetectedFile[];

  /** Lockfile if present */
  lockfile: DetectedFile | null;

  /** Cache directory info */
  cacheDir: DetectedFile | null;

  /** Backups directory info */
  backupsDir: DetectedFile | null;

  /** Gitignore entries added by AlignTrue */
  gitignoreEntries: string[];
}

/**
 * Result of an uninstall operation
 */
export interface UninstallResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Files that were converted (READ-ONLY marker removed) */
  convertedFiles: string[];

  /** Files that were deleted */
  deletedFiles: string[];

  /** Directories that were deleted */
  deletedDirectories: string[];

  /** Gitignore entries that were removed */
  removedGitignoreEntries: string[];

  /** Backup created before uninstall */
  backupTimestamp: string;

  /** Error message if failed */
  error?: string;

  /** Warnings encountered during uninstall */
  warnings: string[];
}

/**
 * Preview of what uninstall would do (for dry-run or confirmation)
 */
export interface UninstallPreview {
  /** Files that would be converted */
  toConvert: string[];

  /** Files that would be deleted */
  toDelete: string[];

  /** Directories that would be deleted */
  toDeleteDirs: string[];

  /** Gitignore entries that would be removed */
  toRemoveFromGitignore: string[];

  /** What would be kept */
  toKeep: string[];
}
