/**
 * Lockfile operations with hash modes (off/soft/strict)
 * 
 * @deprecated Import from './lockfile/index.js' instead
 * This file exists for backward compatibility during refactor
 */

export type {
  Lockfile,
  LockfileEntry,
  LockfileMode,
  Mismatch,
  ValidationResult,
  EnforcementResult,
} from './lockfile/index.js'

export {
  generateLockfile,
  hashRule,
  validateLockfile,
  formatValidationResult,
  enforceLockfile,
  readLockfile,
  writeLockfile,
} from './lockfile/index.js'
