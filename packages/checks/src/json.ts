/**
 * JSON findings emitter
 * 
 * Simpler format for scripting and programmatic consumption.
 */

import type { CheckResult, Finding } from './types.js'

/**
 * JSON findings format
 */
export interface JsonFindings {
  /**
   * Summary statistics
   */
  summary: {
    totalChecks: number
    passed: number
    failed: number
    errors: number
  }

  /**
   * All findings from failed checks
   */
  findings: Finding[]

  /**
   * Errors from checks that couldn't run
   */
  errors: Array<{
    packId: string
    ruleId: string
    error: string
  }>
}

/**
 * Convert check results to JSON findings format
 */
export function emitJson(results: CheckResult[]): JsonFindings {
  const findings: Finding[] = []
  const errors: JsonFindings['errors'] = []

  let passed = 0
  let failed = 0
  let errorCount = 0

  for (const result of results) {
    if (result.error) {
      errorCount++
      errors.push({
        packId: result.packId,
        ruleId: result.rule.id,
        error: result.error,
      })
    } else if (result.pass) {
      passed++
    } else {
      failed++
      findings.push(...result.findings)
    }
  }

  return {
    summary: {
      totalChecks: results.length,
      passed,
      failed,
      errors: errorCount,
    },
    findings,
    errors,
  }
}

