/**
 * Sync operation options and types
 */

/**
 * Options for sync operations
 * Shared between CLI and Core Engine
 */
export interface SyncOptions {
  /**
   * Pull changes from agent back to IR
   */
  acceptAgent?: string;

  /**
   * Preview changes without writing files
   */
  dryRun?: boolean;

  /**
   * Create backup before syncing
   */
  backup?: boolean;

  /**
   * Custom config file path
   */
  configPath?: string;

  /**
   * Bypass validation and force overwrite
   */
  force?: boolean;

  /**
   * Enable interactive prompts
   */
  interactive?: boolean;

  /**
   * Default strategy for conflict resolution
   */
  defaultResolutionStrategy?: string;

  /**
   * Fail if required plugs are unresolved
   */
  strict?: boolean;

  /**
   * Allow sync even with IR validation errors
   */
  forceInvalidIR?: boolean;

  /**
   * Force check all git sources for updates
   */
  forceRefresh?: boolean;

  /**
   * Skip git source update checks
   */
  skipUpdateCheck?: boolean;

  /**
   * Offline mode: use cache only
   */
  offline?: boolean;

  /**
   * Output JSON format
   */
  json?: boolean;

  /**
   * Verbose output
   */
  verbose?: boolean;

  /**
   * Quiet output
   */
  quiet?: boolean;

  /**
   * Show help message
   */
  help?: boolean;

  /**
   * True if -vv or --verbose multiple times
   */
  verboseFull?: boolean;

  /**
   * Accept all prompts including file overwrite conflicts
   */
  yes?: boolean;

  /**
   * Run without prompts (uses defaults)
   */
  nonInteractive?: boolean;

  /**
   * Skip agent detection
   */
  noDetect?: boolean;

  /**
   * Auto-enable detected agents without prompting
   */
  autoEnable?: boolean;

  /**
   * Skip warning about configured exporters not being detected (used during init)
   */
  skipNotFoundWarning?: boolean;

  /**
   * Show detailed conflict information with section content
   */
  showConflicts?: boolean;

  /**
   * Remove exported files that have no matching source rule
   */
  clean?: boolean;

  /**
   * Content export mode for single-file exporters (auto, inline, links)
   */
  contentMode?: "auto" | "inline" | "links";
}
