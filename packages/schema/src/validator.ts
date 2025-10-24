import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseYamlToJson, computeAlignHash } from './canonicalize.js'

// Load the JSON Schema
const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(__dirname, '../schema/align.schema.json')
const alignSchema = JSON.parse(readFileSync(schemaPath, 'utf8'))

// Initialize Ajv in strict mode
const ajv = new Ajv({
  strict: true,
  allErrors: true,
  verbose: true,
  // Add draft 2020-12 support
  validateSchema: false, // Disable metaschema validation to avoid the missing schema error
})
addFormats(ajv)

const validateFn: ValidateFunction = ajv.compile(alignSchema)

/**
 * Result of schema validation
 */
export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}

/**
 * Formatted validation error
 */
export interface ValidationError {
  path: string
  message: string
  keyword?: string
  params?: Record<string, unknown>
}

/**
 * Result of integrity validation
 */
export interface IntegrityResult {
  valid: boolean
  storedHash?: string
  computedHash?: string
  error?: string
}

/**
 * Validate an Align pack against the JSON Schema
 * 
 * @param obj - Parsed Align pack object
 * @returns ValidationResult with errors if invalid
 */
export function validateAlignSchema(obj: unknown): ValidationResult {
  const valid = validateFn(obj)
  
  if (valid) {
    return { valid: true }
  }
  
  const errors = formatValidationErrors(validateFn.errors || [])
  return { valid: false, errors }
}

/**
 * Format Ajv errors into user-friendly messages
 */
function formatValidationErrors(ajvErrors: ErrorObject[]): ValidationError[] {
  return ajvErrors.map(err => ({
    path: err.instancePath || '(root)',
    message: err.message || 'Validation failed',
    keyword: err.keyword,
    params: err.params,
  }))
}

/**
 * Validate Align pack integrity hash
 * 
 * Extracts the stored hash from integrity.value, recomputes the hash,
 * and compares. Returns detailed result.
 * 
 * @param alignYaml - YAML string of Align pack
 * @returns IntegrityResult with validation details
 */
export function validateAlignIntegrity(alignYaml: string): IntegrityResult {
  try {
    // Parse to extract stored hash
    const obj = parseYamlToJson(alignYaml) as Record<string, unknown>
    
    if (!obj['integrity'] || typeof obj['integrity'] !== 'object') {
      return {
        valid: false,
        error: 'Missing integrity field',
      }
    }
    
    const integrity = obj['integrity'] as Record<string, unknown>
    const storedHash = integrity['value'] as string
    
    // Allow <computed> placeholder during authoring
    if (storedHash === '<computed>') {
      return {
        valid: true,
        storedHash,
        computedHash: '<computed>',
      }
    }
    
    // Compute actual hash
    const computedHash = computeAlignHash(alignYaml)
    
    return {
      valid: computedHash === storedHash,
      storedHash,
      computedHash,
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Validate both schema and integrity of an Align pack
 * 
 * @param alignYaml - YAML string of Align pack
 * @returns Combined validation result
 */
export function validateAlign(alignYaml: string): {
  schema: ValidationResult
  integrity: IntegrityResult
} {
  const obj = parseYamlToJson(alignYaml)
  const schema = validateAlignSchema(obj)
  const integrity = validateAlignIntegrity(alignYaml)
  
  return { schema, integrity }
}

// Export types for Align pack structure based on schema
export interface AlignPack {
  id: string
  version: string
  profile: 'align'
  spec_version: '1'
  summary: string
  tags: string[]
  deps: string[]
  scope: AlignScope
  rules: AlignRule[]
  integrity: AlignIntegrity
}

export interface AlignScope {
  applies_to: string[]
  includes?: string[]
  excludes?: string[]
}

export interface AlignRule {
  id: string
  severity: 'MUST' | 'SHOULD' | 'MAY'
  check: AlignCheck
  autofix?: AlignAutofix
}

export interface AlignCheck {
  type: 'file_presence' | 'path_convention' | 'manifest_policy' | 'regex' | 'command_runner'
  inputs: Record<string, unknown>
  evidence: string
}

export interface AlignAutofix {
  hint: string
}

export interface AlignIntegrity {
  algo: 'jcs-sha256'
  value: string
}

