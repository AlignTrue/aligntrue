/**
 * Remote backup system for AlignTrue
 *
 * Provides functionality to push local rules to remote git repositories
 * with support for multiple backup destinations.
 */

export { RemoteBackupManager, createRemoteBackupManager } from "./manager.js";
export { resolveFileAssignments, getBackupStatus } from "./file-resolver.js";
export {
  pushToBackup,
  getLastBackupInfo,
  cleanBackupCache,
  cleanAllBackupCaches,
} from "./git-pusher.js";
export type {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
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
} from "./types.js";
