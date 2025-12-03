/**
 * Remotes system for AlignTrue
 *
 * Provides functionality to sync local rules to remote git repositories
 * with scope-based and pattern-based routing.
 */

export {
  RemotesManager,
  createRemotesManager,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  createRemotesManagerFromLegacy,
  // Legacy aliases
  RemoteBackupManager,
  createRemoteBackupManager,
} from "./manager.js";

export {
  resolveFileAssignments,
  getRemotesStatus,
  convertLegacyConfig,
} from "./file-resolver.js";

export {
  pushToRemote,
  getLastRemoteInfo,
  cleanRemoteCache,
  cleanAllRemoteCaches,
  // Legacy aliases
  pushToBackup,
  getLastBackupInfo,
  cleanBackupCache,
  cleanAllBackupCaches,
} from "./git-pusher.js";

export type {
  RemotesConfig,
  RemoteDestination,
  CustomRemoteDestination,
  // Legacy types
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  RemoteBackupConfig,
  RemoteBackupDestination,
  AdditionalBackupDestination,
  // Result types
  RuleScope,
  ScopedFile,
  FileAssignment,
  ResolutionWarning,
  FileResolutionResult,
  RemotePushResult,
  RemotesSyncResult,
  RemotesOptions,
  RemoteStatus,
} from "./types.js";
