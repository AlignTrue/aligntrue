/**
 * Backup system for AlignTrue
 * 
 * Provides backup and restore functionality for .aligntrue/ directory
 */

export { BackupManager } from './manager.js';
export type {
  BackupMetadata,
  BackupManifest,
  BackupInfo,
  BackupOptions,
  RestoreOptions,
  CleanupOptions
} from './types.js';

