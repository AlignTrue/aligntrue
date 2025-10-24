/**
 * Manifest policy check runner
 */

import type { AlignRule } from '@aligntrue/schema'
import type { CheckResult, CheckContext } from '../types.js'

/**
 * Run manifest_policy check
 * 
 * Validates dependency management files (package.json, lockfiles).
 * Checks that dependencies are properly pinned.
 */
export async function runManifestPolicyCheck(
  rule: AlignRule,
  packId: string,
  context: CheckContext
): Promise<CheckResult> {
  const { fileProvider } = context
  const { inputs, evidence } = rule.check

  if (rule.check.type !== 'manifest_policy') {
    return {
      rule,
      packId,
      pass: false,
      findings: [],
      error: 'Check type mismatch: expected manifest_policy',
    }
  }

  const manifestPath = inputs['manifest'] as string
  const lockfilePath = inputs['lockfile'] as string
  const requirePinned = (inputs['require_pinned'] as boolean | undefined) ?? true

  try {
    // Check if files exist
    const manifestExists = await fileProvider.exists(manifestPath)
    const lockfileExists = await fileProvider.exists(lockfilePath)

    if (!manifestExists) {
      return {
        rule,
        packId,
        pass: false,
        findings: [
          {
            packId,
            ruleId: rule.id,
            severity: rule.severity,
            evidence,
            message: `Manifest file not found: ${manifestPath}`,
            location: { path: manifestPath },
            ...(rule.autofix?.hint ? { autofixHint: rule.autofix.hint } : {}),
          },
        ],
      }
    }

    if (!lockfileExists && requirePinned) {
      return {
        rule,
        packId,
        pass: false,
        findings: [
          {
            packId,
            ruleId: rule.id,
            severity: rule.severity,
            evidence,
            message: `Lockfile not found: ${lockfilePath} (required when require_pinned is true)`,
            location: { path: lockfilePath },
            ...(rule.autofix?.hint ? { autofixHint: rule.autofix.hint } : {}),
          },
        ],
      }
    }

    // Read manifest
    const manifest = (await fileProvider.readJson(manifestPath)) as Record<string, unknown>
    const findings: CheckResult['findings'] = []

    if (requirePinned) {
      // Check dependencies for unpinned versions (versions starting with ^, ~, >, <, etc.)
      const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

      for (const depType of depTypes) {
        const deps = manifest[depType]
        if (!deps || typeof deps !== 'object') continue

        const depsObj = deps as Record<string, string>
        for (const [name, version] of Object.entries(depsObj)) {
          // Check if version is unpinned (has range operators)
          if (/^[\^~><=]/.test(version) || version === '*' || version === 'latest') {
            findings.push({
              packId,
              ruleId: rule.id,
              severity: rule.severity,
              evidence,
              message: `Unpinned dependency: ${name}@${version} in ${depType}`,
              location: { path: manifestPath },
              ...(rule.autofix?.hint ? { autofixHint: rule.autofix.hint } : {}),
            })
          }
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

