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
  retention_days?: number; // Age-based retention (0 = manual only, default: 30)
  minimum_keep?: number; // Safety floor: always keep N most recent (default: 3)
}

export interface RemoteDestination {
  url: string; // Git repository URL
  branch?: string; // Branch to push to (default: main)
  path?: string; // Path prefix in remote repo
  auto?: boolean; // Push on sync (default: true)
}

export interface CustomRemoteDestination extends RemoteDestination {
  id: string; // Unique identifier for this remote
  include: string[]; // Glob patterns for files to include
  scope?: "team" | "personal" | "shared"; // Optional: only apply to rules with this scope
}

/**
 * Remotes configuration for scope-based and pattern-based rule routing
 */
export interface RemotesConfig {
  /**
   * Remote for personal-scope rules (scope: personal in frontmatter)
   * Can be a URL string or full RemoteDestination object
   */
  personal?: string | RemoteDestination;
  /**
   * Remote for shared-scope rules (scope: shared in frontmatter)
   * Can be a URL string or full RemoteDestination object
   */
  shared?: string | RemoteDestination;
  /**
   * Custom remotes with pattern-based routing (ADDITIVE)
   * Files matching patterns are pushed to these remotes IN ADDITION to scope-based routing
   */
  custom?: CustomRemoteDestination[];
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
    checks?: boolean;
    mcp?: boolean;
  };
  /** @deprecated Use modules.lockfile instead */
  lockfile?: Record<string, never>;
  git?: {
    mode?: "ignore" | "commit" | "branch";
    per_exporter?: Record<string, "ignore" | "commit" | "branch">;
    branch_check_interval?: number;
    tag_check_interval?: number;
    offline_fallback?: boolean;
    auto_gitignore?: "auto" | "always" | "never";
  };
  sync?: {
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
   * Remotes configuration for scope-based and pattern-based rule routing
   * Routes rules to remote git repositories based on their scope and/or file patterns
   */
  remotes?: RemotesConfig;
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
