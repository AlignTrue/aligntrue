// Canonicalization and hashing
export {
  parseYamlToJson,
  canonicalizeJson,
  computeHash,
  computeAlignHash,
  verifyAlignHash,
} from "./canonicalize.js";

// JSON utilities (Phase 4.5 consolidation)
export {
  stringifyCanonical,
  computeContentHash,
  parseJsonSafe,
  hashObject,
  compareCanonical,
  type Result,
} from "./json-utils.js";

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
  type AlignSection,
  type AlignIntegrity,
} from "./validator.js";

// Re-export scope types for cross-package consistency
// Note: AlignScope is the IR-level scope (applies_to patterns in packs)
// For config-level scopes, see @aligntrue/core/scope
export type { AlignScope as AlignIRScope } from "./validator.js";

// Plugs v1.1 (Phase 2.5)
export {
  validatePlugKey,
  validatePlugValue,
  validatePlugSlot,
  type PlugFormat,
  type PlugSlot,
  type PlugFill,
  type Plugs,
  type PlugKeyValidation,
  type PlugValueValidation,
} from "./plugs-types.js";
