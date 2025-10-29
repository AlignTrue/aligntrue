/**
 * Markdown validation and formatting commands
 */

import { readFileSync, writeFileSync, renameSync } from 'fs'
import { parseMarkdown, buildIR, validateMarkdown, normalizeWhitespace } from '@aligntrue/markdown-parser'
import { stringify as stringifyYaml } from 'yaml'
import { recordEvent } from '@aligntrue/core/telemetry/collector.js'

export async function md(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: aligntrue md <subcommand> <file> [options]\n')
    console.log('Validate and compile literate markdown files\n')
    console.log('Subcommands:')
    console.log('  lint <file>       Validate markdown aligntrue blocks')
    console.log('  format <file>     Normalize whitespace in aligntrue blocks')
    console.log('  compile <file>    Convert markdown to aligntrue.yaml\n')
    console.log('Options:')
    console.log('  --check           Dry-run mode (format only, no writes)')
    console.log('  --output <file>   Output file path (compile only, default: aligntrue.yaml)')
    process.exit(0)
  }

  const subcommand = args[0]
  const file = args[1]

  if (!file) {
    console.error('Error: File path required')
    console.error('Run: aligntrue md --help')
    process.exit(1)
  }

  switch (subcommand) {
    case 'lint':
      await mdLint(file)
      break
    case 'format':
      await mdFormat(file, args.includes('--check'))
      break
    case 'compile':
      await mdCompile(file, getOutputFile(args))
      break
    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      console.error('Run: aligntrue md --help')
      process.exit(1)
  }
}

async function mdLint(file: string): Promise<void> {
  try {
    const content = readFileSync(file, 'utf-8')
    const result = validateMarkdown(content)

    if (result.valid) {
      console.log(`✓ ${file} is valid`)
      recordEvent({ command_name: 'md-lint', align_hashes_used: [] })
      process.exit(0)
    } else {
      console.error(`✗ ${file} has errors:\n`)
      for (const error of result.errors) {
        const location = error.section
          ? `Line ${error.line} (${error.section})`
          : `Line ${error.line}`
        console.error(`  ${location}: ${error.message}`)
      }
      process.exit(1)
    }
  } catch (err) {
    console.error(`Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}

async function mdFormat(file: string, checkOnly: boolean): Promise<void> {
  try {
    const content = readFileSync(file, 'utf-8')
    const parseResult = parseMarkdown(content)

    if (parseResult.errors.length > 0) {
      console.error(`✗ ${file} has parse errors:\n`)
      for (const error of parseResult.errors) {
        console.error(`  Line ${error.line}: ${error.message}`)
      }
      process.exit(1)
    }

    // Normalize whitespace in each block
    const lines = content.split('\n')
    let modified = false

    for (const block of parseResult.blocks) {
      const normalized = normalizeWhitespace(block.content)
      if (normalized !== block.content) {
        modified = true

        // Replace block content in-place
        // Find the block in the original content
        let currentLine = block.startLine
        const blockLines = normalized.split('\n')
        
        // Remove old content
        lines.splice(currentLine, block.endLine - block.startLine - 1, ...blockLines)
      }
    }

    if (checkOnly) {
      if (modified) {
        console.log(`✗ ${file} needs formatting`)
        process.exit(1)
      } else {
        console.log(`✓ ${file} is already formatted`)
        process.exit(0)
      }
    }

    if (modified) {
      // Write formatted content atomically (temp + rename)
      const tempPath = `${file}.tmp`
      writeFileSync(tempPath, lines.join('\n'), 'utf-8')
      renameSync(tempPath, file)
      console.log(`✓ ${file} formatted`)
    } else {
      console.log(`✓ ${file} already formatted`)
    }
    
    recordEvent({ command_name: 'md-format', align_hashes_used: [] })
    process.exit(0)
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}

async function mdCompile(file: string, outputFile: string): Promise<void> {
  try {
    const content = readFileSync(file, 'utf-8')
    const parseResult = parseMarkdown(content)

    if (parseResult.errors.length > 0) {
      console.error(`✗ ${file} has parse errors:\n`)
      for (const error of parseResult.errors) {
        console.error(`  Line ${error.line}: ${error.message}`)
      }
      process.exit(1)
    }

    const irResult = buildIR(parseResult.blocks)

    if (irResult.errors.length > 0) {
      console.error(`✗ ${file} has IR build errors:\n`)
      for (const error of irResult.errors) {
        const location = error.section
          ? `Line ${error.line} (${error.section})`
          : `Line ${error.line}`
        console.error(`  ${location}: ${error.message}`)
      }
      process.exit(1)
    }

    if (!irResult.document) {
      console.error('✗ Failed to build IR document')
      process.exit(1)
    }

    // Convert to YAML with provenance comment
    const yamlContent = stringifyYaml(irResult.document)
    const output = `# Generated from ${file}\n# Source format: markdown\n\n${yamlContent}`

    if (outputFile === '-') {
      console.log(output)
    } else {
      // Write compiled output atomically (temp + rename)
      const tempPath = `${outputFile}.tmp`
      writeFileSync(tempPath, output, 'utf-8')
      renameSync(tempPath, outputFile)
      console.log(`✓ Compiled ${file} → ${outputFile}`)
    }

    recordEvent({ command_name: 'md-compile', align_hashes_used: [] })
    process.exit(0)
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}

function getOutputFile(args: string[]): string {
  const outputIndex = args.indexOf('--output')
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    return args[outputIndex + 1]!
  }
  return '-' // stdout by default
}

