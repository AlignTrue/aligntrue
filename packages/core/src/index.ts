// Core configuration and validation
export * from "./config/index.js";
// Explicit re-export to avoid ambiguity with lockfile
export type { ScopeConfig } from "./config/index.js";

// Sync engine
export * from "./sync/index.js";
export { GitIntegration } from "./sync/git-integration.js";

// Scopes, bundle, and lockfile
export * from "./scope.js";
export * from "./bundle.js";
export * from "./lockfile/index.js";

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

// Source management
export * from "./sources/index.js";

// Parsing utilities
export type { Section } from "./parsing/section-extractor.js";

// Resource management
export * from "./resources/index.js";

// AlignTrue file protection
export * from "./alignignore/index.js";

// Validation
export * from "./validation/index.js";

// Errors
export * from "./errors.js";

// MCP configuration
export * from "./mcp/generator.js";

// Migration utilities
export * from "./migration/ruler-parser.js";
export * from "./migration/ruler-merger.js";

// Scope discovery
export * from "./scope-discovery.js";

// Overwritten rules management
export {
  backupOverwrittenFile,
  safeBackupFile,
  formatTimestampForFilename,
  checkBackupExists,
  type BackupResult,
} from "./utils/overwritten-rules-manager.js";

// Rule Management
export {
  parseRuleFile,
  writeRuleFile,
  loadRulesDirectory,
  type RuleFile,
} from "./rules/file-io.js";

export {
  detectNestedRuleDirs,
  detectNestedAgentFiles,
  type NestedAgentFile,
} from "./rules/nested-detector.js";
