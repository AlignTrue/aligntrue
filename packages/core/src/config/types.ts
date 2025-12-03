/**
 * Configuration types for AlignTrue
 */

import type { MergeOrder } from "../scope.js";

export type AlignTrueMode = "solo" | "team" | "enterprise";
export type ModeHints = "off" | "metadata_only" | "hints" | "native";
export type ExporterFormat = "native" | "agents-md";
export type CleanupMode = "all" | "managed";
export type ContentMode = "auto" | "inline" | "links";

export interface ExporterConfig {
  format?: ExporterFormat;
  ignore_file?: boolean;
}
export interface PerformanceConfig {
  max_file_size_mb?: number;
  max_directory_depth?: number;
  ignore_patterns?: string[];
}

export interface ExportConfig {
  mode_hints?: {
    default?: ModeHints;
    overrides?: Record<string, ModeHints>;
  };
  max_hint_blocks?: number;
  max_hint_tokens?: number;
}

/**
 * Local backup configuration (for snapshot backups)
 */
export interface LocalBackupConfig {
  keep_count?: number; // Deprecated: use retention_days instead
  retention_days?: number; // Age-based retention (0 = manual only, default: 30)
  minimum_keep?: number; // Safety floor: always keep N most recent (default: 3)
}

/**
 * Remote backup destination configuration
 */
export interface RemoteBackupDestination {
  url: string; // Git repository URL
  branch?: string; // Branch to push to (default: main)
  path?: string; // Path prefix in backup repo (default: preserves structure)
  auto?: boolean; // Push on sync (default: true)
}

/**
 * Additional backup destination with explicit file includes
 */
export interface AdditionalBackupDestination extends RemoteBackupDestination {
  id: string; // Unique identifier for this backup
  include: string[]; // Glob patterns for files to include
}

/**
 * Remote backup configuration for pushing rules to git repositories
 */
export interface RemoteBackupConfig {
  /**
   * Default backup destination - gets all files not assigned to additional backups
   */
  default?: RemoteBackupDestination;
  /**
   * Additional backup destinations with explicit file assignments
   */
  additional?: AdditionalBackupDestination[];
}

export interface DetectionConfig {
  auto_enable?: boolean;
  ignored_agents?: string[];
}

export interface AlignTrueConfig {
  version: string | undefined;
  mode: AlignTrueMode;
  modules?: {
    lockfile?: boolean;
    bundle?: boolean;
    checks?: boolean;
    mcp?: boolean;
  };
  lockfile?: {
    mode?: "off" | "soft" | "strict";
  };
  git?: {
    mode?: "ignore" | "commit" | "branch";
    per_exporter?: Record<string, "ignore" | "commit" | "branch">;
    branch_check_interval?: number;
    tag_check_interval?: number;
    offline_fallback?: boolean;
    auto_gitignore?: "auto" | "always" | "never";
  };
  sync?: {
    watch_enabled?: boolean;
    watch_debounce?: number;
    watch_files?: string[];
    source_markers?: "auto" | "always" | "never";
    content_mode?: ContentMode;
    auto_manage_ignore_files?: boolean | "prompt";
    ignore_file_priority?: "native" | "custom";
    custom_format_priority?: Record<string, string>;
    cleanup?: CleanupMode;
  };
  sources?: Array<{
    type: "local" | "git";
    path?: string;
    url?: string;
    ref?: string;
    check_interval?: number;
    id?: string;
    version?: string;
    include?: string[];
    /**
     * Mark source as personal (skip team approval in team mode)
     * When true, updates from this source don't require team approval
     * Auto-implies gitignore: true unless explicitly set to false
     */
    personal?: boolean;
    /**
     * Mark source as gitignored (rules not committed to git)
     * When true, both source files and exported versions are auto-gitignored
     * Auto-set to true for SSH URLs (git@, ssh://) or when personal: true
     */
    gitignore?: boolean;
    /**
     * @deprecated Use `gitignore` instead. Will be removed in next major version.
     */
    private?: boolean;
  }>;
  exporters?: string[] | Record<string, ExporterConfig>;
  scopes?: Array<{
    path: string;
    inherit?: boolean;
    include?: string[];
    exclude?: string[];
    rulesets?: string[];
  }>;
  merge?: {
    strategy?: "deep";
    order?: MergeOrder;
  };
  performance?: PerformanceConfig;
  export?: ExportConfig;
  backup?: LocalBackupConfig;
  /**
   * Remote backup configuration for pushing rules to git repositories
   * Unidirectional: local .aligntrue/rules/ -> remote repos
   */
  remote_backup?: RemoteBackupConfig;
  detection?: DetectionConfig;
  overlays?: import("../overlays/types.js").OverlayConfig;
  plugs?: {
    fills?: Record<string, string>;
  };
  mcp?: {
    servers?: Array<{
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
      disabled?: boolean;
    }>;
  };
}
