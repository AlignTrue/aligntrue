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

  // Step 7: Confirm file creation
  const aligntrueDir = join(cwd, '.aligntrue')
  const configPath = join(aligntrueDir, 'config.yaml')
  const rulesPath = join(aligntrueDir, 'rules.md')

  clack.log.info('\nWill create:')
  clack.log.info(`  - .aligntrue/config.yaml`)
  clack.log.info(`  - .aligntrue/rules.md`)

  const confirmCreate = await clack.confirm({
    message: 'Continue?',
    initialValue: true,
  })

  if (clack.isCancel(confirmCreate) || !confirmCreate) {
    clack.cancel('Init cancelled')
    process.exit(0)
  }

  // Step 8: Create files
  spinner.start('Creating files')

  // Create .aligntrue/ directory
  if (!existsSync(aligntrueDir)) {
    mkdirSync(aligntrueDir, { recursive: true })
  }

  // Generate config
  const config = {
    version: '1',
    mode: 'solo',
    sources: [
      {
        type: 'local',
        path: '.aligntrue/rules.md',
      },
    ],
    exporters: selectedAgents.length > 0 ? selectedAgents : ['cursor', 'agents-md'],
  }

  writeFileSync(configPath, yaml.stringify(config), 'utf-8')

  // Generate starter template
  const template = getStarterTemplate(projectId)
  writeFileSync(rulesPath, template, 'utf-8')

  spinner.stop('Files created')

  clack.log.success('✓ Created .aligntrue/config.yaml')
  clack.log.success('✓ Created .aligntrue/rules.md')

  // Step 9: Prompt to run sync
  const runSync = await clack.confirm({
    message: 'Run sync now?',
    initialValue: true,
  })

  if (clack.isCancel(runSync)) {
    clack.outro('\nNext steps:\n  1. Edit rules: .aligntrue/rules.md\n  2. Run sync: aligntrue sync')
    process.exit(0)
  }

  if (runSync) {
    clack.log.info('\nRunning sync...')
    // TODO: Import and call sync command here in Step 23
    // For now, just tell user to run it manually
    clack.log.warn('Sync command not yet implemented (Step 23)')
    clack.outro('\nNext steps:\n  1. Edit rules: .aligntrue/rules.md\n  2. Run sync: aligntrue sync (coming in Step 23)')
  } else {
    clack.outro('\nNext steps:\n  1. Edit rules: .aligntrue/rules.md\n  2. Run sync: aligntrue sync')
  }

  // Record telemetry event
  recordEvent({ command_name: 'init', align_hashes_used: [] })

  // TODO: Add catalog source option when catalog is ready (Phase 2+)
  // Prompt: "Start with: [Template] [From catalog] [Import existing]"
  // If catalog: fetch base-global, base-testing, etc.
  // See: docs/refactor-plan.md Phase 2, catalog source provider
}

