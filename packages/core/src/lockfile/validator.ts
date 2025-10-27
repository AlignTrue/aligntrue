/**
 * Lockfile validator with mismatch detection
 */

import type { AlignPack } from '@aligntrue/schema'
import type { Lockfile, ValidationResult, Mismatch } from './types.js'
import { hashRule } from './generator.js'

/**
 * Validate lockfile against current bundle
 * 
 * Compares per-rule hashes and detects:
 * - Modified rules (hash mismatch)
 * - New rules (in bundle but not in lockfile)
 * - Deleted rules (in lockfile but not in bundle)
 * 
 * @param lockfile - Existing lockfile
 * @param currentPack - Current AlignPack to validate against
 * @returns ValidationResult with detailed diff information
 */
export function validateLockfile(lockfile: Lockfile, currentPack: AlignPack): ValidationResult {
  const mismatches: Mismatch[] = []
  const newRules: string[] = []
  const deletedRules: string[] = []
  
  // Build maps for efficient lookup
  const lockfileMap = new Map(
    lockfile.rules.map(entry => [entry.rule_id, entry])
  )
  const currentRules = currentPack.rules || []
  const currentRuleIds = new Set(currentRules.map(r => r.id))
  
  // Check for mismatches and new rules
  for (const rule of currentRules) {
    const lockfileEntry = lockfileMap.get(rule.id)
    
    if (!lockfileEntry) {
      // New rule not in lockfile
      newRules.push(rule.id)
    } else {
      // Check if hash matches
      const currentHash = hashRule(rule)
      if (currentHash !== lockfileEntry.content_hash) {
        mismatches.push({
          rule_id: rule.id,
          expected_hash: lockfileEntry.content_hash,
          actual_hash: currentHash,
          source: lockfileEntry.source,
        })
      }
    }
  }
  
  // Check for deleted rules
  for (const entry of lockfile.rules) {
    if (!currentRuleIds.has(entry.rule_id)) {
      deletedRules.push(entry.rule_id)
    }
  }
  
  const valid = mismatches.length === 0 && newRules.length === 0 && deletedRules.length === 0
  
  return {
    valid,
    mismatches,
    newRules,
    deletedRules,
  }
}

/**
 * Format validation result as human-readable message
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.valid) {
    return 'Lockfile is up to date'
  }
  
  const lines: string[] = ['Lockfile validation failed:']
  
  if (result.mismatches.length > 0) {
    lines.push(`\nModified rules (${result.mismatches.length}):`)
    for (const mismatch of result.mismatches) {
      lines.push(`  - ${mismatch.rule_id}`)
      lines.push(`    Expected: ${mismatch.expected_hash.slice(0, 12)}...`)
      lines.push(`    Actual:   ${mismatch.actual_hash.slice(0, 12)}...`)
    }
  }
  
  if (result.newRules.length > 0) {
    lines.push(`\nNew rules (${result.newRules.length}):`)
    for (const ruleId of result.newRules) {
      lines.push(`  + ${ruleId}`)
    }
  }
  
  if (result.deletedRules.length > 0) {
    lines.push(`\nDeleted rules (${result.deletedRules.length}):`)
    for (const ruleId of result.deletedRules) {
      lines.push(`  - ${ruleId}`)
    }
  }
  
  return lines.join('\n')
}

