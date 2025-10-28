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
 * Parse command-line arguments for init
 */
interface InitArgs {
  help: boolean
  nonInteractive: boolean
  yes: boolean
  projectId?: string
  exporters?: string[]
}

function parseInitArgs(args: string[]): InitArgs {
  const parsed: InitArgs = {
    help: false,
    nonInteractive: false,
    yes: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--non-interactive' || arg === '-n') {
      parsed.nonInteractive = true
    } else if (arg === '--yes' || arg === '-y') {
      parsed.yes = true
    } else if (arg === '--project-id') {
      const nextArg = args[i + 1]
      if (nextArg) {
        parsed.projectId = nextArg
        i++
      }
    } else if (arg === '--exporters') {
      const nextArg = args[i + 1]
      if (nextArg) {
        parsed.exporters = nextArg.split(',').map(e => e.trim())
        i++
      }
    }
  }

  // --yes is alias for --non-interactive
  if (parsed.yes) {
    parsed.nonInteractive = true
  }

  return parsed
}

function showInitHelp(): void {
  console.log(`
aligntrue init - Initialize AlignTrue in a project

USAGE:
  aligntrue init [options]

OPTIONS:
  -h, --help              Show this help message
  -n, --non-interactive   Run without prompts (uses defaults)
  -y, --yes               Same as --non-interactive
  --project-id <id>       Project identifier (default: my-project)
  --exporters <list>      Comma-separated list of exporters (default: auto-detect)

EXAMPLES:
  # Interactive (default)
  aligntrue init

  # Non-interactive with defaults
  aligntrue init --yes

  # Non-interactive with specific settings
  aligntrue init --non-interactive --project-id my-app --exporters cursor,agents-md

  # CI/automation
  aligntrue init -y --project-id ci-project

NOTES:
  - In non-interactive mode, detected agents are auto-enabled
  - If no agents detected, defaults to: cursor, agents-md
  - Project ID defaults to: my-project
  - Native format templates used when available
`)
}

/**
 * Init command implementation
 */
export async function init(args: string[] = []): Promise<void> {
  const parsed = parseInitArgs(args)

  if (parsed.help) {
    showInitHelp()
    return
  }

  const nonInteractive = parsed.nonInteractive

  if (!nonInteractive) {
    clack.intro('AlignTrue Init')
  } else {
    console.log('AlignTrue Init (non-interactive mode)')
  }

  const cwd = process.cwd()

  // Step 1: Detect project context
  const contextResult = detectContext(cwd)

  // Step 2: Handle already-initialized case
  if (contextResult.context === 'already-initialized') {
    const message = `✗ AlignTrue already initialized in this project

Looks like you're joining an existing team setup.

Next steps:
  1. Review rules: .aligntrue/rules.md
  2. Run sync: aligntrue sync

Already have local rules to merge? Run: aligntrue import
Want to reinitialize? Remove .aligntrue/ first (warning: destructive)`

    if (nonInteractive) {
      console.log(message)
    } else {
      clack.outro(message)
    }
    process.exit(0)
  }

  // Step 3: Detect agents
  let spinner: ReturnType<typeof clack.spinner> | null = null
  
  if (!nonInteractive) {
    spinner = clack.spinner()
    spinner.start('Detecting AI coding agents')
  }
  
  const agentResult = detectAgents(cwd)
  
  if (!nonInteractive && spinner) {
    spinner.stop('Agent detection complete')
  }

  if (agentResult.detected.length > 0) {
    const displayNames = agentResult.detected
      .map(name => agentResult.displayNames.get(name) || name)
      .join(', ')
    
    if (nonInteractive) {
      console.log(`Detected agents: ${displayNames}`)
    } else {
      clack.log.success(`Detected: ${displayNames}`)
    }
  } else {
    if (nonInteractive) {
      console.log('No agents detected, using defaults: cursor, agents-md')
    } else {
      clack.log.info('No agents detected (you can still initialize)')
    }
  }

  // Step 4: Handle import flows
  if (contextResult.context === 'import-cursor' || contextResult.context === 'import-agents') {
    const logFn = nonInteractive ? console.log : clack.log.info
    logFn(`\n${getContextDescription(contextResult.context)}: ${contextResult.existingFiles.join(', ')}`)
    
    if (nonInteractive) {
      console.log('Non-interactive mode: continuing with fresh start template')
      console.log('You can import existing rules later with: aligntrue sync --accept-agent <name>')
    } else {
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
  }

  // Step 5: Select agents to enable
  let selectedAgents: string[]

  if (parsed.exporters) {
    // CLI args override detection
    selectedAgents = parsed.exporters
    const msg = `Using exporters from CLI: ${selectedAgents.join(', ')}`
    if (nonInteractive) {
      console.log(msg)
    } else {
      clack.log.info(msg)
    }
  } else if (nonInteractive) {
    // Non-interactive: use detected or defaults
    if (agentResult.detected.length > 0) {
      selectedAgents = agentResult.detected
      console.log(`Will enable: ${agentResult.detected.join(', ')}`)
    } else {
      selectedAgents = ['cursor', 'agents-md']
      console.log('Will enable: cursor, agents-md (defaults)')
    }
  } else if (agentResult.detected.length === 0) {
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
  let projectId: string

  if (parsed.projectId) {
    projectId = parsed.projectId
    const msg = `Using project ID: ${projectId}`
    if (nonInteractive) {
      console.log(msg)
    } else {
      clack.log.info(msg)
    }
  } else if (nonInteractive) {
    projectId = 'my-project'
    console.log('Using default project ID: my-project')
  } else {
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

    projectId = projectIdResponse as string
  }

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

  if (nonInteractive) {
    console.log('\nCreating files:')
    console.log('  - .aligntrue/config.yaml (minimal solo config)')
    if (nativeTemplatePath && nativeTemplate) {
      console.log(`  - ${nativeTemplatePath} (5 starter rules in native format)`)
    } else {
      console.log('  - .aligntrue/rules.md (IR format)')
    }
  } else {
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
  }

  // Step 9: Create files
  if (!nonInteractive && spinner) {
    spinner.start('Creating files')
  }

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

  if (!nonInteractive && spinner) {
    spinner.stop('Files created')
  }

  if (nonInteractive) {
    console.log('\nCreated files:')
    createdFiles.forEach(file => {
      console.log(`  ✓ ${file}`)
    })
  } else {
    createdFiles.forEach(file => {
      clack.log.success(`✓ Created ${file}`)
    })
  }

  // Step 10: Prompt to run sync
  const editPath = nativeTemplatePath || '.aligntrue/rules.md'
  let runSync = true // Default for non-interactive

  if (nonInteractive) {
    console.log('\nNon-interactive mode: running sync automatically')
  } else {
    const runSyncResponse = await clack.confirm({
      message: 'Run sync now?',
      initialValue: true,
    })

    if (clack.isCancel(runSyncResponse)) {
      clack.outro(`\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`)
      process.exit(0)
    }

    runSync = runSyncResponse as boolean
  }

  if (runSync) {
    if (!nonInteractive) {
      clack.log.info('\nRunning sync...')
    }
    
    try {
      // Import and run sync command
      const { sync } = await import('./sync.js')
      await sync([])
    } catch (error) {
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      const nextSteps = `\n✗ Sync failed but files created successfully\n\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`
      
      if (nonInteractive) {
        console.error(errorMsg)
        console.log(nextSteps)
      } else {
        clack.log.error(errorMsg)
        clack.outro(nextSteps)
      }
      process.exit(1)
    }
  } else {
    if (!nonInteractive) {
      clack.outro(`\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`)
    } else {
      console.log(`\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`)
    }
  }

  // Record telemetry event
  recordEvent({ command_name: 'init', align_hashes_used: [] })

  // TODO: Add catalog source option when catalog is ready (Phase 2+)
  // Prompt: "Start with: [Template] [From catalog] [Import existing]"
  // If catalog: fetch base-global, base-testing, etc.
  // See: .internal_docs/refactor-plan.md Phase 2, catalog source provider
}

