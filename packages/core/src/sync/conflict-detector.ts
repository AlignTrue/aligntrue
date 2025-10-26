/**
 * Conflict detection for two-way sync
 * Compares IR vs agent state and generates structured diffs
 */

import type { AlignRule } from '@aligntrue/schema'

/**
 * Conflict record with field-level differences
 */
export interface Conflict {
  agent: string
  ruleId: string
  field: string
  irValue: unknown
  agentValue: unknown
  diff: string
}

/**
 * Result of conflict detection
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean
  conflicts: Conflict[]
}

/**
 * Check if a field is in the volatile list
 */
function isVolatileField(field: string, volatileFields: string[] = []): boolean {
  return volatileFields.some(pattern => {
    // Support wildcards like "cursor.session_id" or "*.volatile_field"
    const regex = new RegExp(`^${pattern.replace('*', '.*')}$`)
    return regex.test(field)
  })
}

/**
 * Extract volatile fields from vendor._meta.volatile
 */
function getVolatileFields(rule: AlignRule): string[] {
  const vendor = rule.vendor as Record<string, unknown> | undefined
  if (!vendor || typeof vendor !== 'object') {
    return []
  }

  const meta = vendor['_meta'] as Record<string, unknown> | undefined
  if (!meta || typeof meta !== 'object') {
    return []
  }

  const volatile = meta['volatile']
  if (Array.isArray(volatile)) {
    return volatile.filter(v => typeof v === 'string') as string[]
  }

  return []
}

/**
 * Deep equality check for values
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object).sort()
    const bKeys = Object.keys(b as object).sort()

    if (aKeys.length !== bKeys.length) return false
    if (aKeys.join(',') !== bKeys.join(',')) return false

    return aKeys.every(key => 
      deepEquals(
        (a as Record<string, unknown>)[key], 
        (b as Record<string, unknown>)[key]
      )
    )
  }

  return false
}

/**
 * Generate a human-readable diff string
 */
function generateDiff(field: string, irValue: unknown, agentValue: unknown): string {
  const irStr = JSON.stringify(irValue, null, 2)
  const agentStr = JSON.stringify(agentValue, null, 2)

  return (
    `Field: ${field}\n` +
    `IR value:\n${irStr}\n` +
    `Agent value:\n${agentStr}`
  )
}

/**
 * Compare vendor bags, ignoring volatile fields
 */
function compareVendorBags(
  irVendor: Record<string, unknown> | undefined,
  agentVendor: Record<string, unknown> | undefined,
  volatileFields: string[],
  agentName: string,
  ruleId: string
): Conflict[] {
  const conflicts: Conflict[] = []

  // If both are undefined, no conflict
  if (!irVendor && !agentVendor) return conflicts

  // Normalize to empty objects if undefined
  const ir = irVendor || {}
  const agent = agentVendor || {}

  // Get all agent-specific keys (exclude _meta)
  const agentKeys = Object.keys(agent).filter(k => k !== '_meta')
  const irKeys = Object.keys(ir).filter(k => k !== '_meta')

  // Check for differences in agent-specific vendor bags
  for (const key of new Set([...agentKeys, ...irKeys])) {
    const fullField = `vendor.${key}`

    // Skip if this entire vendor bag is volatile
    if (isVolatileField(fullField, volatileFields)) {
      continue
    }

    const irValue = ir[key]
    const agentValue = agent[key]

    // Skip if values are equal
    if (deepEquals(irValue, agentValue)) {
      continue
    }

    // Check individual fields within the vendor bag
    if (typeof irValue === 'object' && typeof agentValue === 'object' && irValue && agentValue) {
      const irObj = irValue as Record<string, unknown>
      const agentObj = agentValue as Record<string, unknown>

      for (const subKey of new Set([...Object.keys(irObj), ...Object.keys(agentObj)])) {
        const fullSubField = `${fullField}.${subKey}`

        // Skip volatile fields
        if (isVolatileField(fullSubField, volatileFields)) {
          continue
        }

        const irSubValue = irObj[subKey]
        const agentSubValue = agentObj[subKey]

        if (!deepEquals(irSubValue, agentSubValue)) {
          conflicts.push({
            agent: agentName,
            ruleId,
            field: fullSubField,
            irValue: irSubValue,
            agentValue: agentSubValue,
            diff: generateDiff(fullSubField, irSubValue, agentSubValue),
          })
        }
      }
    } else {
      // Entire vendor bag differs
      conflicts.push({
        agent: agentName,
        ruleId,
        field: fullField,
        irValue,
        agentValue,
        diff: generateDiff(fullField, irValue, agentValue),
      })
    }
  }

  return conflicts
}

/**
 * Conflict detector for comparing IR vs agent state
 */
export class ConflictDetector {
  /**
   * Detect conflicts between IR rules and agent rules
   */
  detectConflicts(
    agentName: string,
    irRules: AlignRule[],
    agentRules: AlignRule[]
  ): ConflictDetectionResult {
    const conflicts: Conflict[] = []

    // Create lookup maps by rule ID
    const irMap = new Map(irRules.map(r => [r.id, r]))
    const agentMap = new Map(agentRules.map(r => [r.id, r]))

    // Check each IR rule against agent rules
    for (const [ruleId, irRule] of irMap) {
      const agentRule = agentMap.get(ruleId)

      // If rule doesn't exist in agent, no conflict (new rule)
      if (!agentRule) {
        continue
      }

      // Get volatile fields for this rule
      const volatileFields = getVolatileFields(irRule)

      // Compare core fields (excluding vendor bags initially)
      const coreFields = ['severity', 'applies_to', 'guidance'] as const

      for (const field of coreFields) {
        const irValue = irRule[field]
        const agentValue = agentRule[field]

        if (!deepEquals(irValue, agentValue)) {
          conflicts.push({
            agent: agentName,
            ruleId,
            field,
            irValue,
            agentValue,
            diff: generateDiff(field, irValue, agentValue),
          })
        }
      }

      // Compare vendor bags (ignore volatile fields)
      const vendorConflicts = compareVendorBags(
        irRule.vendor as Record<string, unknown> | undefined,
        agentRule.vendor as Record<string, unknown> | undefined,
        volatileFields,
        agentName,
        ruleId
      )

      conflicts.push(...vendorConflicts)
    }

    // Check for rules in agent that don't exist in IR (deleted rules)
    for (const [ruleId, agentRule] of agentMap) {
      if (!irMap.has(ruleId)) {
        conflicts.push({
          agent: agentName,
          ruleId,
          field: '(entire rule)',
          irValue: undefined,
          agentValue: agentRule,
          diff: generateDiff('(entire rule)', undefined, agentRule),
        })
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    }
  }
}

