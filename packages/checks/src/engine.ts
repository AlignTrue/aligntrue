/**
 * Main checks engine orchestrator
 */

import type { AlignPack } from '@aligntrue/schema'
import type { CheckResult, CheckContext, RunChecksOptions } from './types.js'
import { hasCheck } from './types.js'
import { DiskFileProvider } from './providers/disk.js'
import { runFilePresenceCheck } from './runners/file-presence.js'
import { runPathConventionCheck } from './runners/path-convention.js'
import { runManifestPolicyCheck } from './runners/manifest-policy.js'
import { runRegexCheck } from './runners/regex.js'
import { runCommandRunnerCheck } from './runners/command-runner.js'

/**
 * Run all checks for an Align pack
 * 
 * @param alignPack - Validated Align pack object
 * @param options - Execution options
 * @returns Array of check results (one per rule)
 */
export async function runChecks(
  alignPack: AlignPack,
  options: RunChecksOptions = {}
): Promise<CheckResult[]> {
  const fileProvider = options.fileProvider || new DiskFileProvider(options.workingDir)
  const workingDir = options.workingDir || process.cwd()

  const context: CheckContext = {
    fileProvider,
    workingDir,
    executionConfig: {
      allowExec: options.allowExec ?? false,
      ...(options.envWhitelist ? { envWhitelist: options.envWhitelist } : {}),
      ...(options.defaultTimeout ? { defaultTimeout: options.defaultTimeout } : {}),
    },
    ...(options.changedFiles ? { changedFiles: options.changedFiles } : {}),
  }

  const results: CheckResult[] = []

  for (const rule of alignPack.rules) {
    const result = await runCheck(rule, alignPack.id, context)
    results.push(result)
  }

  return results
}

/**
 * Run a single check based on its type
 */
async function runCheck(
  rule: AlignPack['rules'][0],
  packId: string,
  context: CheckContext
): Promise<CheckResult> {
  // Skip rules without checks
  if (!hasCheck(rule)) {
    return {
      rule,
      packId,
      pass: true,
      findings: [],
    }
  }

  const checkType = rule.check.type

  switch (checkType) {
    case 'file_presence':
      return runFilePresenceCheck(rule, packId, context)
    case 'path_convention':
      return runPathConventionCheck(rule, packId, context)
    case 'manifest_policy':
      return runManifestPolicyCheck(rule, packId, context)
    case 'regex':
      return runRegexCheck(rule, packId, context)
    case 'command_runner':
      return runCommandRunnerCheck(rule, packId, context)
    default:
      return {
        rule,
        packId,
        pass: false,
        findings: [],
        error: `Unknown check type: ${checkType}`,
      }
  }
}

