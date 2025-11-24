// Canonicalization and hashing
export {
  parseYamlToJson,
  canonicalizeJson,
  computeHash,
  computeAlignHash,
  verifyAlignHash,
} from "./canonicalize.js";

// JSON utilities (Code consolidation)
export {
  stringifyCanonical,
  computeContentHash,
  parseJsonSafe,
  hashObject,
  compareCanonical,
  cloneDeep,
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
  type AlignTrueVendorMetadata,
} from "./validator.js";

// Re-export scope types for cross-package consistency
// Note: AlignScope is the IR-level scope (applies_to patterns in packs)
// For config-level scopes, see @aligntrue/core/scope
export type { AlignScope as AlignIRScope } from "./validator.js";

// Plugs v1.1 (Plugs system)
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

// Section parser (shared markdown parsing)
export {
  parseAgentsMd,
  parseCursorMdc,
  parseGenericMarkdown,
  type ParsedSection,
  type ParsedFile,
} from "./section-parser.js";

// Frontmatter Schema
export {
  type RuleFrontmatter,
  type CursorMetadata,
  type AgentMetadata,
  type RuleFile,
  frontmatterSchema,
} from "./frontmatter.js";
