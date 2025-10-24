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

