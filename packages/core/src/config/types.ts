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
export type ResourceType = "rules" | "mcps" | "skills";
export type ScopeType = "team" | "personal" | string; // Allow custom scopes
export type StorageType = "repo" | "local" | "remote";

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

export interface BackupConfig {
  keep_count?: number; // Deprecated: use retention_days instead
  retention_days?: number; // Age-based retention (0 = manual only, default: 30)
  minimum_keep?: number; // Safety floor: always keep N most recent (default: 3)
}

export interface DetectionConfig {
  auto_enable?: boolean;
  ignored_agents?: string[];
}

export interface ScopeConfig {
  sections: string[] | "*";
}

export interface StorageConfig {
  type: StorageType;
  url?: string; // For remote storage
  branch?: string; // For remote storage
  path?: string; // Subdirectory in remote
}

export interface ResourceConfig {
  scopes: Record<string, ScopeConfig>;
  storage: Record<string, StorageConfig>;
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
    per_adapter?: Record<string, "ignore" | "commit" | "branch">;
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
    type: "local" | "git" | "url";
    path?: string;
    url?: string;
    ref?: string;
    check_interval?: number;
    id?: string;
    version?: string;
    include?: string[];
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
  backup?: BackupConfig;
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
  resources?: Record<ResourceType, ResourceConfig>;
  storage?: Record<string, StorageConfig>;
}
