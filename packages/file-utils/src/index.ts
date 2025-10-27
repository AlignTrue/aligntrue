/**
 * @aligntrue/file-utils
 * 
 * Shared file operation utilities for the AlignTrue ecosystem.
 * Provides atomic writes, checksum tracking, and safe file operations.
 */

export {
  AtomicFileWriter,
  computeFileChecksum,
  computeContentChecksum,
  ensureDirectoryExists,
  type ChecksumRecord,
} from './atomic-writer.js'

