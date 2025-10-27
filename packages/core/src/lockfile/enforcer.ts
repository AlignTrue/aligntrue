/**
 * Lockfile mode enforcement (off/soft/strict)
 */

import type { LockfileMode, ValidationResult, EnforcementResult } from './types.js'
import { formatValidationResult } from './validator.js'

/**
 * Enforce lockfile validation based on mode
 * 
 * Modes:
 * - off: Skip validation, always succeed
 * - soft: Warn to stderr on mismatch, exit 0
 * - strict: Error to stderr on mismatch, exit 1
 * 
 * @param mode - Lockfile mode from config
 * @param validation - Validation result from validateLockfile
 * @returns EnforcementResult with exit code
 */
export function enforceLockfile(mode: LockfileMode, validation: ValidationResult): EnforcementResult {
  // Off mode: skip all validation
  if (mode === 'off') {
    return {
      success: true,
      exitCode: 0,
    }
  }
  
  // If validation passed, succeed regardless of mode
  if (validation.valid) {
    return {
      success: true,
      message: 'Lockfile validation passed',
      exitCode: 0,
    }
  }
  
  // Format validation result
  const message = formatValidationResult(validation)
  
  // Soft mode: warn but allow to continue
  if (mode === 'soft') {
    console.warn('\n⚠️  Lockfile drift detected (soft mode):\n')
    console.warn(message)
    console.warn('\nSync will continue. Run `aligntrue lock` to update the lockfile.\n')
    
    return {
      success: true,  // Allow sync to continue
      message,
      exitCode: 0,
    }
  }
  
  // Strict mode: error and abort
  if (mode === 'strict') {
    console.error('\n❌ Lockfile validation failed (strict mode):\n')
    console.error(message)
    console.error('\nSync aborted. Run `aligntrue lock` to update the lockfile.\n')
    
    return {
      success: false,  // Block sync
      message,
      exitCode: 1,
    }
  }
  
  // Unknown mode (should not happen with type checking)
  throw new Error(`Unknown lockfile mode: ${mode}`)
}

