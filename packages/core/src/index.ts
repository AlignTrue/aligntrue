// Core configuration and validation
export * from "./config/index.js";

// Sync engine
export * from "./sync/index.js";
export { GitIntegration } from "./sync/git-integration.js";

// Scopes, bundle, and lockfile
export * from "./scope.js";
export * from "./bundle.js";
export * from "./lockfile/index.js";

// Performance monitoring and optimization
export * from "./performance/index.js";

// Privacy
export * from "./privacy/index.js";

// File system utilities
export * from "./paths.js";

// Backup and restore (local)
export { BackupManager } from "./backup/index.js";
export type {
  BackupMetadata,
  BackupManifest,
  BackupInfo,
  BackupOptions as BackupRestoreOptions,
  RestoreOptions,
  CleanupOptions,
} from "./backup/index.js";

// Remote backup (push to git repositories)
export {
  RemoteBackupManager,
  createRemoteBackupManager,
  resolveFileAssignments,
  getBackupStatus as getRemoteBackupStatus,
  pushToBackup,
  getLastBackupInfo,
  cleanBackupCache,
  cleanAllBackupCaches,
} from "./remote-backup/index.js";
export type {
  RemoteBackupConfig,
  RemoteBackupDestination,
  AdditionalBackupDestination,
  FileAssignment,
  ResolutionWarning,
  FileResolutionResult,
  BackupPushResult,
  RemoteBackupResult,
  RemoteBackupOptions,
  RemoteBackupStatus,
} from "./remote-backup/index.js";

// Team mode features
export * from "./team/index.js";

// Plugs system
export * from "./plugs/index.js";

// Overlay system (Overlays system)
export * from "./overlays/index.js";

// Source caching
export * from "./cache/index.js";

// Source management
export * from "./sources/index.js";

// Parsing utilities
export type { Section } from "./parsing/section-extractor.js";

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
  detectNonMdFiles,
  type RuleFile,
} from "./rules/file-io.js";

export {
  detectNestedRuleDirs,
  detectNestedAgentFiles,
  type NestedAgentFile,
} from "./rules/nested-detector.js";

// Import system
export {
  importRules,
  detectConflicts,
  resolveConflict,
  detectSourceType,
  parseSourceUrl,
  type ImportOptions,
  type ImportResult,
  type ConflictInfo,
  type ConflictResolution,
} from "./import/index.js";

// Similarity detection
export {
  normalizeTokens,
  jaccardSimilarity,
  findSimilarContent,
  DEFAULT_SIMILARITY_THRESHOLD,
  type FileWithContent,
  type SimilarityGroup,
  type SimilarityResult,
} from "./similarity/index.js";

// Audit logging
export {
  type AuditAction,
  type AuditEvent,
  type ImportEvent,
  type RenameEvent,
  type DeleteEvent,
  type AuditLogEvent,
  getHistoryPath,
  appendAuditEvent,
  logImport,
  logRename,
  logDelete,
  readAuditLog,
  getImportHistory,
} from "./audit/index.js";
