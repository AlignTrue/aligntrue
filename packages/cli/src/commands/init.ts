/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as clack from '@clack/prompts'
import * as yaml from 'yaml'
import { detectContext, getContextDescription } from '../utils/detect-context.js'
import { detectAgents, getAgentDisplayName } from '../utils/detect-agents.js'
import { getStarterTemplate } from '../templates/starter-rules.js'
import { generateCursorStarter, getCursorStarterPath } from '../templates/cursor-starter.js'
import { generateAgentsMdStarter, getAgentsMdStarterPath } from '../templates/agents-md-starter.js'
import { recordEvent } from '@aligntrue/core/telemetry/collector.js'

/**
 * Init command implementation
 */
export async function init(): Promise<void> {
  clack.intro('AlignTrue Init')

  const cwd = process.cwd()

  // Step 1: Detect project context
  const contextResult = detectContext(cwd)

  // Step 2: Handle already-initialized case
  if (contextResult.context === 'already-initialized') {
    clack.outro(`✗ AlignTrue already initialized in this project

Looks like you're joining an existing team setup.

Next steps:
  1. Review rules: .aligntrue/rules.md
  2. Run sync: aligntrue sync

Already have local rules to merge? Run: aligntrue import
Want to reinitialize? Remove .aligntrue/ first (warning: destructive)`)
    process.exit(0)
  }

  // Step 3: Detect agents
  const spinner = clack.spinner()
  spinner.start('Detecting AI coding agents')
  
  const agentResult = detectAgents(cwd)
  spinner.stop('Agent detection complete')

  if (agentResult.detected.length > 0) {
    const displayNames = agentResult.detected
      .map(name => agentResult.displayNames.get(name) || name)
      .join(', ')
    clack.log.success(`Detected: ${displayNames}`)
  } else {
    clack.log.info('No agents detected (you can still initialize)')
  }

  // Step 4: Handle import flows
  if (contextResult.context === 'import-cursor' || contextResult.context === 'import-agents') {
    clack.log.info(`\n${getContextDescription(contextResult.context)}: ${contextResult.existingFiles.join(', ')}`)
    
    // TODO: Implement import flow in Step 17
    // For now, suggest manual setup
    clack.log.warn('Import feature coming in Step 17')
    clack.log.info('For now, you can:')
    clack.log.info('  1. Continue with fresh start (creates template)')
    clack.log.info('  2. Manually copy your rules to .aligntrue/rules.md after init')
    
    const continueImport = await clack.confirm({
      message: 'Continue with fresh start template?',
      initialValue: true,
    })

    if (clack.isCancel(continueImport) || !continueImport) {
      clack.cancel('Init cancelled')
      process.exit(0)
    }
  }

  // Step 5: Select agents to enable
  let selectedAgents: string[]

  if (agentResult.detected.length === 0) {
    // No agents detected - use defaults
    clack.log.info('\nUsing default exporters: cursor, agents-md')
    selectedAgents = ['cursor', 'agents-md']
  } else if (agentResult.detected.length <= 3) {
    // ≤3 detected: enable all automatically
    selectedAgents = agentResult.detected
    const displayNames = selectedAgents
      .map(name => agentResult.displayNames.get(name) || name)
      .join(', ')
    clack.log.success(`Will enable: ${displayNames}`)
  } else {
    // >3 detected: prompt to select
    const options = agentResult.detected.map(name => ({
      value: name,
      label: agentResult.displayNames.get(name) || name,
    }))

    const selected = await clack.multiselect({
      message: 'Select agents to enable:',
      options,
      initialValues: agentResult.detected,
      required: false,
    })

    if (clack.isCancel(selected)) {
      clack.cancel('Init cancelled')
      process.exit(0)
    }

    selectedAgents = selected as string[]
  }

  // Step 6: Get project ID for template
  const projectIdResponse = await clack.text({
    message: 'Project ID (for rules identifier):',
    placeholder: 'my-project',
    initialValue: 'my-project',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Project ID is required'
      }
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Use lowercase letters, numbers, and hyphens only'
      }
    },
  })

  if (clack.isCancel(projectIdResponse)) {
    clack.cancel('Init cancelled')
    process.exit(0)
  }

  const projectId = projectIdResponse as string

  // Step 7: Determine primary agent and template format
  const primaryAgent = selectedAgents[0] || 'cursor'
  const useNativeFormat = ['cursor', 'copilot', 'claude-code', 'aider', 'agents-md'].includes(primaryAgent)
  
  let nativeTemplatePath: string | null = null
  let nativeTemplate: string | null = null
  
  if (useNativeFormat) {
    if (primaryAgent === 'cursor') {
      nativeTemplatePath = getCursorStarterPath()
      nativeTemplate = generateCursorStarter()
    } else {
      // For all other agents, use AGENTS.md format
      nativeTemplatePath = getAgentsMdStarterPath()
      nativeTemplate = generateAgentsMdStarter()
    }
  }

  // Step 8: Confirm file creation
  const aligntrueDir = join(cwd, '.aligntrue')
  const configPath = join(aligntrueDir, 'config.yaml')

  clack.log.info('\nWill create:')
  clack.log.info(`  - .aligntrue/config.yaml (minimal solo config)`)
  
  if (nativeTemplatePath && nativeTemplate) {
    clack.log.info(`  - ${nativeTemplatePath} (5 starter rules in native format)`)
  } else {
    clack.log.info(`  - .aligntrue/rules.md (IR format)`)
  }

  const confirmCreate = await clack.confirm({
    message: 'Continue?',
    initialValue: true,
  })

  if (clack.isCancel(confirmCreate) || !confirmCreate) {
    clack.cancel('Init cancelled')
    process.exit(0)
  }

  // Step 9: Create files
  spinner.start('Creating files')

  // Create .aligntrue/ directory
  if (!existsSync(aligntrueDir)) {
    mkdirSync(aligntrueDir, { recursive: true })
  }

  // Generate minimal config (solo mode defaults)
  const config = {
    exporters: selectedAgents.length > 0 ? selectedAgents : ['cursor', 'agents-md'],
  }

  writeFileSync(configPath, yaml.stringify(config), 'utf-8')

  // Create native format template or IR fallback
  const createdFiles: string[] = ['.aligntrue/config.yaml']
  
  if (nativeTemplatePath && nativeTemplate) {
    // Create native format starter
    const nativeFullPath = join(cwd, nativeTemplatePath)
    const nativeDir = join(cwd, nativeTemplatePath.substring(0, nativeTemplatePath.lastIndexOf('/')))
    
    if (!existsSync(nativeDir)) {
      mkdirSync(nativeDir, { recursive: true })
    }
    
    writeFileSync(nativeFullPath, nativeTemplate, 'utf-8')
    createdFiles.push(nativeTemplatePath)
  } else {
    // Fallback to IR format
    const rulesPath = join(aligntrueDir, 'rules.md')
    const template = getStarterTemplate(projectId)
    writeFileSync(rulesPath, template, 'utf-8')
    createdFiles.push('.aligntrue/rules.md')
  }

  spinner.stop('Files created')

  createdFiles.forEach(file => {
    clack.log.success(`✓ Created ${file}`)
  })

  // Step 9: Prompt to run sync
  const runSync = await clack.confirm({
    message: 'Run sync now?',
    initialValue: true,
  })

  const editPath = nativeTemplatePath || '.aligntrue/rules.md'
  
  if (clack.isCancel(runSync)) {
    clack.outro(`\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`)
    process.exit(0)
  }

  if (runSync) {
    clack.log.info('\nRunning sync...')
    
    try {
      // Import and run sync command
      const { sync } = await import('./sync.js')
      await sync([])
    } catch (error) {
      clack.log.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
      clack.outro(`\n✗ Sync failed but files created successfully\n\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`)
      process.exit(1)
    }
  } else {
    clack.outro(`\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`)
  }

  // Record telemetry event
  recordEvent({ command_name: 'init', align_hashes_used: [] })

  // TODO: Add catalog source option when catalog is ready (Phase 2+)
  // Prompt: "Start with: [Template] [From catalog] [Import existing]"
  // If catalog: fetch base-global, base-testing, etc.
  // See: docs/refactor-plan.md Phase 2, catalog source provider
}

