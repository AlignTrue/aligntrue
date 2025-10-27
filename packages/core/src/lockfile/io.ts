/**
 * Lockfile I/O with atomic writes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { dirname } from 'path'
import type { Lockfile } from './types.js'

/**
 * Read lockfile from disk
 * 
 * @param path - Path to lockfile (typically .aligntrue.lock.json)
 * @returns Lockfile object or null if not found
 */
export function readLockfile(path: string): Lockfile | null {
  if (!existsSync(path)) {
    return null
  }
  
  try {
    const content = readFileSync(path, 'utf8')
    const lockfile = JSON.parse(content) as Lockfile
    
    // Basic validation
    if (!lockfile.version || !lockfile.rules || !lockfile.bundle_hash) {
      throw new Error('Invalid lockfile structure')
    }
    
    return lockfile
  } catch (err) {
    throw new Error(
      `Failed to read lockfile: ${path}\n` +
      `  ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Write lockfile to disk atomically
 * 
 * Uses temp+rename pattern to prevent partial writes
 * JSON formatted with 2-space indent and sorted keys
 * 
 * @param path - Path to lockfile (typically .aligntrue.lock.json)
 * @param lockfile - Lockfile object to write
 */
export function writeLockfile(path: string, lockfile: Lockfile): void {
  // Ensure parent directory exists
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  
  // Serialize with sorted keys and 2-space indent
  const json = JSON.stringify(lockfile, sortKeys, 2) + '\n'
  
  // Atomic write: temp file + rename
  const tempPath = `${path}.tmp`
  
  try {
    writeFileSync(tempPath, json, 'utf8')
    renameSync(tempPath, path)
  } catch (err) {
    // Clean up temp file on failure
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath)
      } catch {
        // Ignore cleanup errors
      }
    }
    
    throw new Error(
      `Failed to write lockfile: ${path}\n` +
      `  ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * JSON.stringify replacer to sort keys alphabetically
 */
function sortKeys(key: string, value: any): any {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value)
      .sort()
      .reduce((sorted, k) => {
        sorted[k] = value[k]
        return sorted
      }, {} as Record<string, any>)
  }
  return value
}

