/**
 * IR loading with support for markdown and YAML formats
 */

import { readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import * as yaml from 'js-yaml'
import { parseMarkdown, buildIR } from '@aligntrue/markdown-parser'
import { validateAlignSchema, type AlignPack, type ValidationResult } from '@aligntrue/schema'

/**
 * Load IR from a markdown or YAML file
 * Auto-detects format based on file extension
 */
export async function loadIR(sourcePath: string): Promise<AlignPack> {
  // Check file exists
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Source file not found: ${sourcePath}\n` +
      `  Check the path is correct and the file exists.`
    )
  }

  // Read file content
  let content: string
  try {
    content = readFileSync(sourcePath, 'utf8')
  } catch (err) {
    throw new Error(
      `Failed to read source file: ${sourcePath}\n` +
      `  ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // Auto-detect format based on extension
  const ext = extname(sourcePath).toLowerCase()
  let ir: unknown

  if (ext === '.md' || ext === '.markdown') {
    // Parse markdown with fenced blocks
    try {
      const parseResult = parseMarkdown(content)
      
      // Check for parsing errors
      if (parseResult.errors.length > 0) {
        const errorList = parseResult.errors
          .map(err => `  - Line ${err.line}: ${err.message}`)
          .join('\n')
        throw new Error(`Markdown parsing errors:\n${errorList}`)
      }
      
      ir = buildIR(parseResult.blocks)
    } catch (err) {
      throw new Error(
        `Failed to parse markdown in ${sourcePath}\n` +
        `  ${err instanceof Error ? err.message : String(err)}\n` +
        `  Check for syntax errors in fenced \`\`\`aligntrue blocks.`
      )
    }
  } else if (ext === '.yaml' || ext === '.yml') {
    // Parse YAML directly
    try {
      ir = yaml.load(content)
    } catch (err) {
      const yamlErr = err as { mark?: { line?: number; column?: number } }
      const location = yamlErr.mark
        ? ` at line ${yamlErr.mark.line! + 1}, column ${yamlErr.mark.column! + 1}`
        : ''

      throw new Error(
        `Failed to parse YAML in ${sourcePath}${location}\n` +
        `  ${err instanceof Error ? err.message : String(err)}\n` +
        `  Check for syntax errors (indentation, quotes, colons).`
      )
    }
  } else {
    throw new Error(
      `Unsupported file format: ${ext}\n` +
      `  Supported formats: .md, .markdown, .yaml, .yml\n` +
      `  Source: ${sourcePath}`
    )
  }

  // Validate loaded IR
  if (typeof ir !== 'object' || ir === null) {
    throw new Error(
      `Invalid IR in ${sourcePath}: must be an object\n` +
      `  Got: ${typeof ir}`
    )
  }
  
  const validation = validateAlignSchema(ir)
  if (!validation.valid) {
    const errorList = validation.errors
      ?.map(err => `  - ${err.path}: ${err.message}`)
      .join('\n') || '  Unknown validation error'

    throw new Error(
      `Invalid IR in ${sourcePath}:\n${errorList}\n` +
      `  Fix the errors above and try again.`
    )
  }

  return ir as AlignPack
}

