/**
 * Import command - analyze and import rules from agent formats
 */

import { existsSync } from 'fs'
import { join } from 'path'
import * as clack from '@clack/prompts'
import { importFromAgent, canImportFromAgent, getImportSourcePath } from '@aligntrue/core'
import {
  analyzeCursorCoverage,
  analyzeAgentsMdCoverage,
  formatCoverageReport,
  type CoverageReport,
} from '@aligntrue/markdown-parser'
import { writeFile } from 'fs/promises'
import type { AlignRule } from '@aligntrue/schema'

/**
 * Import command arguments
 */
interface ImportArgs {
  agent?: string
  coverage: boolean
  write: boolean
  dryRun: boolean
  help: boolean
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ImportArgs {
  const parsed: ImportArgs = {
    coverage: true, // default to showing coverage
    write: false,
    dryRun: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--coverage') {
      parsed.coverage = true
    } else if (arg === '--no-coverage') {
      parsed.coverage = false
    } else if (arg === '--write') {
      parsed.write = true
    } else if (arg === '--dry-run') {
      parsed.dryRun = true
    } else if (!arg.startsWith('-')) {
      parsed.agent = arg
    }
  }

  return parsed
}

/**
 * Show help text
 */
function showHelp(): void {
  console.log(`
aligntrue import - Analyze and import rules from agent formats

Usage:
  aligntrue import <agent> [options]

Arguments:
  agent              Agent format to analyze (cursor, agents-md)

Options:
  --coverage         Show import coverage report (default: true)
  --no-coverage      Skip coverage report
  --write            Write imported rules to .aligntrue/rules.md
  --dry-run          Preview without writing files
  --help, -h         Show this help message

Examples:
  # Analyze Cursor .mdc files and show coverage
  aligntrue import cursor

  # Import from AGENTS.md with coverage report
  aligntrue import agents-md

  # Import and write to IR file
  aligntrue import cursor --write

  # Preview import without writing
  aligntrue import cursor --write --dry-run

Supported Agents:
  cursor             .cursor/rules/*.mdc files
  agents-md          AGENTS.md universal format
  copilot            AGENTS.md format (alias)
  claude-code        AGENTS.md format (alias)
  aider              AGENTS.md format (alias)

Notes:
  - Coverage report shows field-level mapping from agent format to IR
  - Import preserves vendor.* metadata for round-trip fidelity
  - Use --write to update .aligntrue/rules.md with imported rules
`)
}

/**
 * Generate coverage report for imported rules
 */
function generateCoverageReport(agent: string, rules: AlignRule[]): CoverageReport {
  const normalizedAgent = agent.toLowerCase()
  
  if (normalizedAgent === 'cursor') {
    return analyzeCursorCoverage(rules)
  } else if (['agents-md', 'copilot', 'claude-code', 'aider'].includes(normalizedAgent)) {
    return analyzeAgentsMdCoverage(rules)
  } else {
    throw new Error(`Coverage analysis not available for agent: ${agent}`)
  }
}

/**
 * Write imported rules to IR file
 */
async function writeToIRFile(rules: AlignRule[], dryRun: boolean): Promise<void> {
  const irPath = join(process.cwd(), '.aligntrue', 'rules.md')
  
  // Generate markdown content
  const lines: string[] = []
  lines.push('# AlignTrue Rules')
  lines.push('')
  lines.push('Rules imported from agent format.')
  lines.push('')
  
  for (const rule of rules) {
    lines.push('```aligntrue')
    lines.push(`id: ${rule.id}`)
    lines.push(`severity: ${rule.severity}`)
    
    if (rule.applies_to) {
      lines.push('applies_to:')
      for (const pattern of rule.applies_to) {
        lines.push(`  - ${pattern}`)
      }
    }
    
    if (rule.tags) {
      lines.push('tags:')
      for (const tag of rule.tags) {
        lines.push(`  - ${tag}`)
      }
    }
    
    if (rule.vendor) {
      lines.push('vendor:')
      lines.push(`  # Preserved from original format`)
      lines.push(JSON.stringify(rule.vendor, null, 2).split('\n').slice(1, -1).join('\n'))
    }
    
    lines.push('```')
    lines.push('')
    
    if (rule.guidance) {
      lines.push(rule.guidance)
      lines.push('')
    }
  }
  
  const content = lines.join('\n')
  
  if (dryRun) {
    console.log('\nPreview of .aligntrue/rules.md:')
    console.log('─'.repeat(50))
    console.log(content.split('\n').slice(0, 30).join('\n'))
    if (content.split('\n').length > 30) {
      console.log('... (truncated)')
    }
  } else {
    await writeFile(irPath, content, 'utf-8')
    clack.log.success(`Wrote ${rules.length} rules to ${irPath}`)
  }
}

/**
 * Import command entry point
 */
export async function importCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args)

  // Show help
  if (parsed.help || !parsed.agent) {
    showHelp()
    process.exit(parsed.help ? 0 : 1)
  }

  const agent = parsed.agent!
  const workspaceRoot = process.cwd()

  clack.intro('Import from agent format')

  // Step 1: Validate agent support
  if (!canImportFromAgent(agent)) {
    clack.log.error(`Import not supported for agent: ${agent}`)
    clack.log.info('Supported agents: cursor, agents-md, copilot, claude-code, aider')
    process.exit(1)
  }

  // Step 2: Check if source exists
  const sourcePath = getImportSourcePath(agent, workspaceRoot)
  if (!existsSync(sourcePath)) {
    clack.log.error(`Agent format not found: ${sourcePath}`)
    
    if (agent === 'cursor') {
      clack.log.info('Expected: .cursor/rules/ directory with .mdc files')
    } else {
      clack.log.info('Expected: AGENTS.md file in workspace root')
    }
    
    process.exit(1)
  }

  // Step 3: Import rules
  const spinner = clack.spinner()
  spinner.start('Importing rules')

  let rules: AlignRule[]
  try {
    rules = await importFromAgent(agent, workspaceRoot)
    spinner.stop(`Imported ${rules.length} rules from ${agent}`)
  } catch (error) {
    spinner.stop('Import failed')
    clack.log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  if (rules.length === 0) {
    clack.log.warn('No rules found in agent format')
    process.exit(0)
  }

  // Step 4: Generate and display coverage report
  if (parsed.coverage) {
    try {
      const report = generateCoverageReport(agent, rules)
      const formatted = formatCoverageReport(report)
      
      console.log('')
      console.log(formatted)
      console.log('')
    } catch (error) {
      clack.log.warn(`Coverage analysis failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Step 5: Write to IR file if requested
  if (parsed.write) {
    try {
      await writeToIRFile(rules, parsed.dryRun)
    } catch (error) {
      clack.log.error(`Failed to write IR file: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  }

  clack.outro('Import complete')
}

