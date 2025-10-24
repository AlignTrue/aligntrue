/**
 * Path convention check runner
 */

import type { AlignRule } from '@aligntrue/schema'
import type { CheckResult, CheckContext } from '../types.js'

/**
 * Run path_convention check
 * 
 * Validates that file paths follow a naming convention regex.
 */
export async function runPathConventionCheck(
  rule: AlignRule,
  packId: string,
  context: CheckContext
): Promise<CheckResult> {
  const { fileProvider } = context
  const { inputs, evidence } = rule.check

  if (rule.check.type !== 'path_convention') {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: 'Check type mismatch: expected path_convention',
    }
  }

  const pattern = inputs['pattern'] as string
  const include = inputs['include'] as string[]
  const message = inputs['message'] as string

  try {
    const regex = new RegExp(pattern)
    const findings: CheckResult['findings'] = []

    // Check each include pattern
    for (const includePattern of include) {
      const files = await fileProvider.glob(includePattern)

      for (const file of files) {
        // Extract just the filename (not the full path for the convention check)
        const fileName = file.split('/').pop() || file

        if (!regex.test(fileName)) {
          findings.push({
            packId,
            ruleId: rule.id,
            severity: rule.severity,
            evidence,
            message: `${message}: ${file} (expected pattern: ${pattern})`,
            location: { path: file },
            ...(rule.autofix?.hint ? { autofixHint: rule.autofix.hint } : {}),
          })
        }
      }
    }

    return {
      rule,
      packId,
      pass: findings.length === 0,
      findings,
    }
  } catch (err) {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

