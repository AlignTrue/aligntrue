// Canonicalization and hashing
export {
  parseYamlToJson,
  canonicalizeJson,
  computeHash,
  computeAlignHash,
  verifyAlignHash,
} from './canonicalize.js'

// Validation
export {
  validateAlignSchema,
  validateAlignIntegrity,
  validateAlign,
  type ValidationResult,
  type ValidationError,
  type IntegrityResult,
  type AlignPack,
  type AlignScope,
  type AlignRule,
  type AlignCheck,
  type AlignAutofix,
  type AlignIntegrity,
} from './validator.js'

// Re-export scope types for cross-package consistency
// Note: AlignScope is the IR-level scope (applies_to patterns in packs)
// For config-level scopes, see @aligntrue/core/scope
export type { AlignScope as AlignIRScope } from './validator.js'

