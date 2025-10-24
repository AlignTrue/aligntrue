/**
 * AlignTrue Checks - Check runner engine
 * 
 * Public API for running checks against Align packs.
 */

// Main engine
export { runChecks } from './engine.js'

// Types
export type {
  FileProvider,
  GlobOptions,
  Location,
  Finding,
  CheckResult,
  ExecutionConfig,
  CheckContext,
  RunChecksOptions,
  CheckRunner,
} from './types.js'

// Providers
export { DiskFileProvider } from './providers/disk.js'

// Emitters
export { emitSarif } from './sarif.js'
export type { SarifLog, SarifRun, SarifResult, SarifLocation } from './sarif.js'

export { emitJson } from './json.js'
export type { JsonFindings } from './json.js'

// Individual check runners (for advanced usage)
export { runFilePresenceCheck } from './runners/file-presence.js'
export { runPathConventionCheck } from './runners/path-convention.js'
export { runManifestPolicyCheck } from './runners/manifest-policy.js'
export { runRegexCheck } from './runners/regex.js'
export { runCommandRunnerCheck } from './runners/command-runner.js'

