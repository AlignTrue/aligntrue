// Core configuration and validation
export * from "./config/index.js";
// Explicit re-export to avoid ambiguity with lockfile
export type { ScopeConfig } from "./config/index.js";

// Two-way sync engine
export * from "./sync/index.js";
export { GitIntegration } from "./sync/git-integration.js";

// Scopes, bundle, and lockfile
export * from "./scope.js";
export * from "./bundle.js";
export * from "./lockfile/index.js";
// Explicit re-export to avoid ambiguity with sync
export type { ValidationResult } from "./lockfile/index.js";

// Performance monitoring and optimization
export * from "./performance/index.js";

// Telemetry and privacy
export * from "./telemetry/collector.js";
export * from "./privacy/index.js";

// File system utilities
export * from "./paths.js";

// Backup and restore
export { BackupManager } from "./backup/index.js";
export type {
  BackupMetadata,
  BackupManifest,
  BackupInfo,
  BackupOptions as BackupRestoreOptions,
  RestoreOptions,
  CleanupOptions,
} from "./backup/index.js";

// Team mode features
export * from "./team/index.js";

// Plugs system
export * from "./plugs/index.js";

// Overlay system (Overlays system)
export * from "./overlays/index.js";

// Source caching
export * from "./cache/index.js";

// Storage system
export * from "./storage/index.js";

// Parsing utilities
export type { Section } from "./parsing/section-extractor.js";

// Resource management
export * from "./resources/index.js";

// Validation
export * from "./validation/team-mode.js";

// Migration utilities
export * from "./migration/ruler-parser.js";
export * from "./migration/ruler-merger.js";

// Scope discovery
export * from "./scope-discovery.js";
