/**
 * Convert markdown fenced blocks to canonical IR
 */

import { parse as parseYaml } from 'yaml'
import type { FencedBlock } from './parser.js'

export interface IRDocument {
  id: string
  version: string
  spec_version: string
  rules: unknown[]
  source_format?: 'markdown' | 'yaml'
  [key: string]: unknown
}

export interface IRBuildError {
  blockIndex: number
  line: number
  message: string
  section?: string
}

export interface IRBuildResult {
  document?: IRDocument
  errors: IRBuildError[]
}

/**
 * Build IR document from parsed fenced blocks
 */
export function buildIR(blocks: FencedBlock[]): IRBuildResult {
  const errors: IRBuildError[] = []

  if (blocks.length === 0) {
    return {
      errors: [
        {
          blockIndex: 0,
          line: 1,
          message: 'No aligntrue blocks found in markdown',
        },
      ],
    }
  }

  // For now, we expect a single document block or multiple rule blocks
  // If first block has 'id' field, treat as full document
  // Otherwise, treat all blocks as rules to be combined

  try {
    const firstBlock = blocks[0]
    if (!firstBlock) {
      return {
        errors: [
          {
            blockIndex: 0,
            line: 1,
            message: 'No blocks provided',
          },
        ],
      }
    }
    
    const normalized = normalizeWhitespace(firstBlock.content)
    const parsed = parseYaml(normalized)

    // Check if this is a full document (has id, version, rules)
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'rules' in parsed) {
      // Full document in first block - validate and return
      const doc = parsed as IRDocument
      
      // Ensure source_format is set
      if (!doc.source_format) {
        doc.source_format = 'markdown'
      }

      // Merge guidance if present
      if (firstBlock.guidanceBefore && !('guidance' in doc)) {
        (doc as Record<string, unknown>)['guidance'] = firstBlock.guidanceBefore
      }

      return { document: doc, errors: [] }
    }

    // Otherwise, treat each block as a rule and build a document
    const rules: unknown[] = []
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      if (!block) continue
      
      try {
        const ruleNormalized = normalizeWhitespace(block.content)
        const rule = parseYaml(ruleNormalized)

        if (!rule || typeof rule !== 'object') {
          errors.push({
            blockIndex: i,
            line: block.startLine,
            ...(block.sectionTitle !== undefined && { section: block.sectionTitle }),
            message: 'Block does not contain a valid YAML object',
          })
          continue
        }

        // Merge guidance from markdown prose into rule
        if (block.guidanceBefore && !('guidance' in rule)) {
          ;(rule as Record<string, unknown>)['guidance'] = block.guidanceBefore
        }

        rules.push(rule)
      } catch (err) {
        errors.push({
          blockIndex: i,
          line: block.startLine,
          ...(block.sectionTitle !== undefined && { section: block.sectionTitle }),
          message: err instanceof Error ? err.message : 'Invalid YAML',
        })
      }
    }

    if (errors.length > 0) {
      return { errors }
    }

    // Build a minimal document from rules
    // In practice, the user should provide id/version in first block or config
    // For now, create a placeholder that will fail validation
    const document: IRDocument = {
      id: '__placeholder__',
      version: '0.0.0',
      spec_version: '1',
      rules,
      source_format: 'markdown',
    }

    return { document, errors: [] }
  } catch (err) {
    const firstBlock = blocks[0]
    errors.push({
      blockIndex: 0,
      line: firstBlock?.startLine || 1,
      ...(firstBlock?.sectionTitle !== undefined && { section: firstBlock.sectionTitle }),
      message: err instanceof Error ? err.message : 'Failed to parse YAML',
    })
    return { errors }
  }
}

/**
 * Normalize whitespace in YAML content
 * - Convert tabs to 2 spaces
 * - Remove trailing whitespace from lines
 * - Ensure single newline at EOF
 * - Preserve intentional blank lines
 */
export function normalizeWhitespace(yaml: string): string {
  const lines = yaml.split('\n')

  const normalized = lines.map((line) => {
    // Convert tabs to 2 spaces
    const spacesReplaced = line.replace(/\t/g, '  ')
    
    // Remove trailing whitespace
    return spacesReplaced.replace(/\s+$/, '')
  })

  // Join with newlines and ensure single newline at EOF
  let result = normalized.join('\n')
  
  // Remove multiple trailing newlines, ensure exactly one
  result = result.replace(/\n+$/, '') + '\n'

  return result
}

