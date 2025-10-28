/**
 * Config command - Display and edit configuration
 */

import { existsSync } from 'fs'
import { join } from 'path'
import * as clack from '@clack/prompts'
import { spawn } from 'child_process'

/**
 * Parse command-line arguments for config command
 */
interface ConfigArgs {
  subcommand?: 'show' | 'edit'
  help: boolean
}

function parseArgs(args: string[]): ConfigArgs {
  const parsed: ConfigArgs = {
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (!parsed.subcommand && (arg === 'show' || arg === 'edit')) {
      parsed.subcommand = arg
    }
  }

  return parsed
}

/**
 * Show help text for config command
 */
function showHelp(): void {
  console.log(`Usage: aligntrue config <subcommand>

Display or edit configuration

Subcommands:
  show    Display active configuration with mode and effective settings
  edit    Open config file in default editor

Examples:
  aligntrue config show
  aligntrue config edit

Description:
  The 'show' command displays your active mode (solo/team/enterprise) and
  effective configuration including defaults.
  
  The 'edit' command opens .aligntrue/config.yaml in your default editor.
`)
  process.exit(0)
}

/**
 * Config command implementation
 */
export async function config(args: string[]): Promise<void> {
  const parsed = parseArgs(args)
  
  if (parsed.help || !parsed.subcommand) {
    showHelp()
    return
  }

  const cwd = process.cwd()
  const configPath = join(cwd, '.aligntrue', 'config.yaml')

  // Check if config exists
  if (!existsSync(configPath)) {
    clack.log.error(`Config file not found: ${configPath}`)
    clack.log.info(`Run 'aligntrue init' to create initial configuration`)
    process.exit(1)
  }

  if (parsed.subcommand === 'show') {
    await showConfig(configPath)
  } else if (parsed.subcommand === 'edit') {
    await editConfig(configPath)
  }
}

/**
 * Show configuration with mode and effective settings
 */
async function showConfig(configPath: string): Promise<void> {
  clack.intro('AlignTrue Configuration')

  try {
    const { loadConfig } = await import('@aligntrue/core')
    const cfg = await loadConfig(configPath)

    // Display mode prominently
    const modeColors: Record<string, string> = {
      solo: '🟢',
      team: '🟡',
      enterprise: '🔵',
    }
    console.log(`\n${modeColors[cfg.mode] || '⚪'} Mode: ${cfg.mode.toUpperCase()}`)

    // Display key settings
    console.log(`\n📋 Configuration:`)
    console.log(`  Version: ${cfg.version}`)
    console.log(`  Exporters: ${cfg.exporters?.join(', ') || 'none'}`)
    
    if (cfg.sync) {
      console.log(`\n🔄 Sync:`)
      console.log(`  Auto-pull: ${cfg.sync.auto_pull ?? 'not set'}`)
      if (cfg.sync.primary_agent) {
        console.log(`  Primary agent: ${cfg.sync.primary_agent}`)
      }
      console.log(`  On conflict: ${cfg.sync.on_conflict || 'prompt'}`)
    }

    if (cfg.modules) {
      console.log(`\n⚙️  Modules:`)
      console.log(`  Lockfile: ${cfg.modules.lockfile ? 'enabled' : 'disabled'}`)
      console.log(`  Bundle: ${cfg.modules.bundle ? 'enabled' : 'disabled'}`)
      console.log(`  Checks: ${cfg.modules.checks ? 'enabled' : 'disabled'}`)
    }

    if (cfg.lockfile && cfg.modules?.lockfile) {
      console.log(`\n🔒 Lockfile:`)
      console.log(`  Mode: ${cfg.lockfile.mode || 'off'}`)
    }

    if (cfg.git) {
      console.log(`\n📦 Git:`)
      console.log(`  Mode: ${cfg.git.mode || 'ignore'}`)
    }

    if (cfg.scopes && cfg.scopes.length > 0) {
      console.log(`\n📍 Scopes: ${cfg.scopes.length} configured`)
    }

    console.log(`\n📝 Config file: ${configPath}`)
    
    clack.outro('Configuration displayed')
  } catch (error) {
    clack.log.error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

/**
 * Open config file in default editor
 */
async function editConfig(configPath: string): Promise<void> {
  clack.intro('Edit Configuration')

  // Determine editor
  const editor = process.env['EDITOR'] || process.env['VISUAL'] || 'vi'

  clack.log.info(`Opening ${configPath} in ${editor}`)

  return new Promise((resolve, reject) => {
    const child = spawn(editor, [configPath], {
      stdio: 'inherit',
      shell: true,
    })

    child.on('exit', (code) => {
      if (code === 0) {
        clack.outro('Configuration updated')
        resolve()
      } else {
        clack.log.error(`Editor exited with code ${code}`)
        reject(new Error(`Editor exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      clack.log.error(`Failed to open editor: ${err.message}`)
      reject(err)
    })
  })
}

