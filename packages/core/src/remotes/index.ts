/**
 * Remotes system for AlignTrue
 *
 * Provides functionality to sync local rules to remote git repositories
 * with scope-based and pattern-based routing.
 */

export { RemotesManager, createRemotesManager } from "./manager.js";

export {
  resolveFileAssignments,
  getRemotesStatus,
  type FileResolutionOptions,
} from "./file-resolver.js";

export {
  pushToRemote,
  getLastRemoteInfo,
  cleanRemoteCache,
  cleanAllRemoteCaches,
} from "./git-pusher.js";

export type {
  RemotesConfig,
  RemoteDestination,
  CustomRemoteDestination,
  RuleScope,
  ScopedFile,
  FileAssignment,
  ResolutionWarning,
  FileResolutionResult,
  FileResolutionDiagnostics,
  UnroutedFile,
  RemotePushResult,
  RemotesSyncResult,
  RemotesOptions,
  RemoteStatus,
} from "./types.js";
