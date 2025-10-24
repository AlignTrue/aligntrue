import { createHash } from 'crypto'
import { load as parseYaml } from 'js-yaml'
import canonicalize from 'canonicalize'

/**
 * Parse YAML string to plain JavaScript object
 */
export function parseYamlToJson(yaml: string): unknown {
  return parseYaml(yaml)
}

/**
 * Apply JCS (RFC 8785) canonicalization to an object
 * Returns canonical JSON string with stable key ordering
 */
export function canonicalizeJson(obj: unknown): string {
  const canonical = canonicalize(obj)
  if (canonical === undefined) {
    throw new Error('Canonicalization failed: input produced undefined')
  }
  return canonical
}

/**
 * Compute SHA-256 hash of a string and return hex-encoded result
 */
export function computeHash(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

/**
 * Compute integrity hash for an Align pack YAML document
 * 
 * Process:
 * 1. Parse YAML to object
 * 2. Set integrity.value to "<pending>"
 * 3. Apply JCS canonicalization
 * 4. Compute SHA-256 hash
 * 
 * @param alignYaml - YAML string of Align pack
 * @returns Hex-encoded SHA-256 hash
 */
export function computeAlignHash(alignYaml: string): string {
  // Parse YAML to object
  const obj = parseYamlToJson(alignYaml) as Record<string, unknown>
  
  // Ensure integrity field exists
  if (!obj['integrity'] || typeof obj['integrity'] !== 'object') {
    throw new Error('Align pack missing integrity field')
  }
  
  // Set integrity.value to pending for canonical hashing
  const integrity = obj['integrity'] as Record<string, unknown>
  integrity['value'] = '<pending>'
  
  // Canonicalize and hash
  const canonical = canonicalizeJson(obj)
  return computeHash(canonical)
}

/**
 * Validate that a stored hash matches the computed hash
 * 
 * @param alignYaml - YAML string of Align pack
 * @param storedHash - The hash value from integrity.value field
 * @returns true if hashes match
 */
export function verifyAlignHash(alignYaml: string, storedHash: string): boolean {
  const computed = computeAlignHash(alignYaml)
  return computed === storedHash
}

