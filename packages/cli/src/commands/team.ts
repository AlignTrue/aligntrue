/**
 * Team mode management commands
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs'
import { dirname } from 'path'
import { stringify as stringifyYaml } from 'yaml'
import * as clack from '@clack/prompts'
import { recordEvent } from '@aligntrue/core/telemetry/collector.js'
import { tryLoadConfig } from '../utils/config-loader.js'

export async function team(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: aligntrue team <subcommand>\n')
    console.log('Subcommands:')
    console.log('  enable         Upgrade to team mode (enables lockfile + bundle)\n')
    console.log('Team mode features:')
    console.log('  - Lockfile generation for reproducibility')
    console.log('  - Bundle generation for multi-source merging')
    console.log('  - Drift detection with soft/strict validation')
    console.log('  - Git-based collaboration workflows')
    process.exit(0)
  }

  const subcommand = args[0]

  switch (subcommand) {
    case 'enable':
      await teamEnable()
      break
    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      console.error('Run: aligntrue team --help')
      process.exit(1)
  }
}

async function teamEnable(): Promise<void> {
  const configPath = '.aligntrue/config.yaml'

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error('✗ Config file not found: .aligntrue/config.yaml')
    console.error('  Run: aligntrue init')
    process.exit(1)
  }

  try {
    // Load current config (with standardized error handling)
    const config = await tryLoadConfig(configPath)

    // Check if already in team mode
    if (config.mode === 'team') {
      console.log('✓ Already in team mode')
      console.log('\nTeam mode features active:')
      console.log(`  - Lockfile: ${config.modules?.lockfile ? 'enabled' : 'disabled'}`)
      console.log(`  - Bundle: ${config.modules?.bundle ? 'enabled' : 'disabled'}`)
      process.exit(0)
    }

    // Show what will change
    clack.intro('Team Mode Enable')
    
    const changes = [
      'mode: solo → team',
      'modules.lockfile: false → true',
      'modules.bundle: false → true',
    ]
    
    clack.log.info(`Changes to .aligntrue/config.yaml:\n${changes.map(c => `  - ${c}`).join('\n')}`)

    const shouldProceed = await clack.confirm({
      message: 'Enable team mode?',
      initialValue: true,
    })

    if (clack.isCancel(shouldProceed) || !shouldProceed) {
      clack.cancel('Team mode enable cancelled')
      process.exit(0)
    }

    // Update config
    config.mode = 'team'
    config.modules = {
      ...config.modules,
      lockfile: true,
      bundle: true,
    }

    // Write config back atomically
    const yamlContent = stringifyYaml(config)
    const tempPath = `${configPath}.tmp`
    
    // Ensure directory exists
    mkdirSync(dirname(configPath), { recursive: true })
    
    // Write to temp file first
    writeFileSync(tempPath, yamlContent, 'utf-8')
    
    // Atomic rename (OS-level guarantee)
    renameSync(tempPath, configPath)

    // Record telemetry event
    recordEvent({ command_name: 'team-enable', align_hashes_used: [] })

    clack.outro('✓ Team mode enabled')
    
    console.log('\nNext steps:')
    console.log('  1. Run: aligntrue sync')
    console.log('  2. Lockfile will be generated automatically')
    console.log('  3. Commit both config.yaml and .aligntrue.lock.json')
    console.log('\nTeam members can now:')
    console.log('  - Clone the repo and run aligntrue sync')
    console.log('  - Get identical rule outputs (deterministic)')
    console.log('  - Detect drift with lockfile validation')
    process.exit(0)

  } catch (err) {
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith('process.exit')) {
      throw err
    }
    console.error('✗ Failed to enable team mode')
    console.error(`  ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

