/**
 * Sync command - Sync rules to agents
 * Orchestrates loading config, pulling sources, and syncing IR to/from agents
 */

import { existsSync } from 'fs'
import { join, resolve } from 'path'
import * as clack from '@clack/prompts'
import { SyncEngine } from '@aligntrue/core'
import { ExporterRegistry } from '@aligntrue/exporters'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { recordEvent } from '@aligntrue/core/telemetry/collector.js'
import { canonicalizeJson } from '@aligntrue/schema'
import { createHash } from 'node:crypto'

// Get the exporters package directory for adapter discovery
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Parse command-line arguments for sync command
 */
interface SyncArgs {
  dryRun: boolean
  acceptAgent?: string | undefined
  force: boolean
  config?: string | undefined
  help: boolean
}

function parseArgs(args: string[]): SyncArgs {
  const parsed: SyncArgs = {
    dryRun: false,
    force: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--dry-run') {
      parsed.dryRun = true
    } else if (arg === '--force') {
      parsed.force = true
    } else if (arg === '--accept-agent') {
      parsed.acceptAgent = args[++i]
    } else if (arg === '--config') {
      parsed.config = args[++i]
    }
  }

  return parsed
}

/**
 * Show help text for sync command
 */
function showHelp(): void {
  console.log(`Usage: aligntrue sync [options]

Sync rules from IR to configured agents (default direction)

Basic Options:
  --dry-run              Preview changes without writing files
  --config <path>        Custom config file path (default: .aligntrue/config.yaml)

Advanced Options:
  --accept-agent <name>  Pull changes from agent back to IR (requires Step 17)
  --force                Non-interactive mode (skip prompts)
  --help, -h             Show this help message

Examples:
  aligntrue sync
  aligntrue sync --dry-run
  aligntrue sync --config custom/config.yaml

Description:
  Loads rules from .aligntrue/rules.md (or configured source), resolves scopes,
  and syncs to configured agent exporters (Cursor, AGENTS.md, VS Code MCP, etc.).

  In team mode with lockfile enabled, validates lockfile before syncing.

  Default direction: IR → agents (rules.md to agent config files)
  Pullback direction: agents → IR (with --accept-agent flag)
`)
  process.exit(0)
}

/**
 * Sync command implementation
 */
export async function sync(args: string[]): Promise<void> {
  const parsed = parseArgs(args)
  
  if (parsed.help) {
    showHelp()
    return
  }

  clack.intro('AlignTrue Sync')

  const cwd = process.cwd()
  const configPath = parsed.config || join(cwd, '.aligntrue', 'config.yaml')

  // Step 1: Check if AlignTrue is initialized
  if (!existsSync(configPath)) {
    clack.outro(`✗ Config file not found

What: ${configPath} does not exist
Why: AlignTrue needs configuration to know which agents to sync
Fix: Run 'aligntrue init' to create initial configuration`)
    process.exit(1)
  }

  // Step 2: Load config
  const spinner = clack.spinner()
  spinner.start('Loading configuration')

  let config: any
  try {
    const { loadConfig } = await import('@aligntrue/core')
    config = await loadConfig(configPath)
    spinner.stop('Configuration loaded')
  } catch (error) {
    spinner.stop('Configuration load failed')
    clack.log.error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`)
    clack.outro('✗ Sync failed')
    process.exit(1)
  }

  // Step 3: Validate source path
  const sourcePath = config.sources?.[0]?.path || '.aligntrue/rules.md'
  const absoluteSourcePath = resolve(cwd, sourcePath)

  if (!existsSync(absoluteSourcePath)) {
    clack.outro(`✗ Source file not found

What: ${sourcePath} does not exist
Why: AlignTrue needs rules to sync to agents
Fix: Create rules file or update sources in .aligntrue/config.yaml

Expected path: ${absoluteSourcePath}`)
    process.exit(1)
  }

  // Step 4: Check for --accept-agent flag (mock data warning)
  if (parsed.acceptAgent) {
    clack.log.warn('⚠ Using mock data for agent import (real parsers coming in Step 17)')
    clack.log.info(`Attempting to sync from: ${parsed.acceptAgent}`)
  }

  // Step 5: Discover and load exporters
  spinner.start('Loading exporters')

  const engine = new SyncEngine()
  const registry = new ExporterRegistry()

  try {
    // Discover adapters from exporters package
    // Look for manifests in the exporters src directory
    const exportersSrcPath = resolve(__dirname, '../../../exporters/src')
    const manifestPaths = registry.discoverAdapters(exportersSrcPath)

    // Load manifests and handlers for configured exporters
    const exporterNames = config.exporters || ['cursor', 'agents-md']
    let loadedCount = 0

    for (const exporterName of exporterNames) {
      // Find manifest for this exporter
      const manifestPath = manifestPaths.find(path => {
        const manifest = registry.loadManifest(path)
        return manifest.name === exporterName
      })

      if (manifestPath) {
        await registry.registerFromManifest(manifestPath)
        const exporter = registry.get(exporterName)
        if (exporter) {
          engine.registerExporter(exporter)
          loadedCount++
        }
      } else {
        clack.log.warn(`Exporter not found: ${exporterName}`)
      }
    }

    spinner.stop(`Loaded ${loadedCount} exporter${loadedCount !== 1 ? 's' : ''}`)
    
    if (loadedCount > 0) {
      const names = exporterNames.slice(0, loadedCount).join(', ')
      clack.log.success(`Active: ${names}`)
    }
  } catch (error) {
    spinner.stop('Exporter loading failed')
    clack.log.error(`Failed to load exporters: ${error instanceof Error ? error.message : String(error)}`)
    clack.outro('✗ Sync failed')
    process.exit(1)
  }

  // Step 6: Execute sync
  spinner.start(parsed.dryRun ? 'Previewing changes' : 'Syncing to agents')

  try {
    const syncOptions: any = {
      configPath,
      dryRun: parsed.dryRun,
      force: parsed.force,
      interactive: !parsed.force,
    }
    
    if (parsed.acceptAgent !== undefined) {
      syncOptions.acceptAgent = parsed.acceptAgent
    }

    let result
    if (parsed.acceptAgent) {
      // Agent → IR sync (pullback)
      result = await engine.syncFromAgent(parsed.acceptAgent, absoluteSourcePath, syncOptions)
    } else {
      // IR → agents sync (default)
      result = await engine.syncToAgents(absoluteSourcePath, syncOptions)
    }

    spinner.stop(parsed.dryRun ? 'Preview complete' : 'Sync complete')

    // Step 7: Display results
    if (result.success) {
      if (parsed.dryRun) {
        clack.log.info('Dry-run mode: no files written')
      }

      // Show written files
      if (result.written && result.written.length > 0) {
        clack.log.success(`${parsed.dryRun ? 'Would write' : 'Wrote'} ${result.written.length} file${result.written.length !== 1 ? 's' : ''}`)
        result.written.forEach(file => {
          clack.log.info(`  ${file}`)
        })
      }

      // Show warnings
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          clack.log.warn(warning)
        })
      }

      // Show conflicts
      if (result.conflicts && result.conflicts.length > 0) {
        clack.log.warn(`${result.conflicts.length} conflict${result.conflicts.length !== 1 ? 's' : ''} detected`)
        result.conflicts.forEach(conflict => {
          clack.log.info(`  ${conflict.ruleId}.${conflict.field}: IR=${JSON.stringify(conflict.irValue)} vs Agent=${JSON.stringify(conflict.agentValue)}`)
        })
      }

      // Show audit trail in dry-run
      if (parsed.dryRun && result.auditTrail && result.auditTrail.length > 0) {
        clack.log.info('\nAudit trail:')
        result.auditTrail.forEach(entry => {
          clack.log.info(`  [${entry.action}] ${entry.target}: ${entry.details}`)
        })
      }

      // Record telemetry event on success
      try {
        const loadedAdapters = registry.list().map(name => registry.get(name)!).filter(Boolean)
        const exportTargets = loadedAdapters.map(a => a.name).join(',')
        
        recordEvent({
          command_name: 'sync',
          export_target: exportTargets,
          align_hashes_used: [], // Rule hashes would require loading the IR file again
        })
      } catch (telemetryError) {
        // Telemetry errors should not fail the sync command
        // Silently continue
      }

      clack.outro(parsed.dryRun ? '✓ Preview complete' : '✓ Sync complete')
    } else {
      // Sync failed
      clack.log.error('Sync failed')
      
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          clack.log.error(`  ${warning}`)
        })
      }
      
      clack.outro('✗ Sync failed')
      process.exit(1)
    }
  } catch (error) {
    spinner.stop('Sync failed')
    clack.log.error(`Sync error: ${error instanceof Error ? error.message : String(error)}`)
    
    // Show helpful suggestions
    if (error instanceof Error) {
      if (error.message.includes('lockfile')) {
        clack.log.info('Lockfile drift detected. Options:')
        clack.log.info('  1. Review changes and update lockfile: aligntrue lock')
        clack.log.info('  2. Set lockfile.mode: soft in config for warnings only')
      } else if (error.message.includes('exporter')) {
        clack.log.info('Check exporter configuration in .aligntrue/config.yaml')
      }
    }
    
    clack.outro('✗ Sync failed')
    process.exit(1)
  }
}

