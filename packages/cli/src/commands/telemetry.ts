/**
 * Telemetry management commands
 * Simple file-based telemetry enable/disable (infrastructure in Step 26)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs'
import { dirname } from 'path'
import { recordEvent } from '@aligntrue/core/telemetry/collector.js'
import { exitWithError } from '../utils/error-formatter.js'
import { CommonErrors as Errors } from '../utils/common-errors.js'

interface TelemetryConfig {
  enabled: boolean;
  uuid?: string;
}

const TELEMETRY_PATH = '.aligntrue/telemetry.json'

export async function telemetry(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: aligntrue telemetry <subcommand>\n')
    console.log('Subcommands:')
    console.log('  on             Enable anonymous telemetry')
    console.log('  off            Disable telemetry')
    console.log('  status         Show current telemetry status\n')
    console.log('What we collect (when enabled):')
    console.log('  - Command name (init, sync, etc.)')
    console.log('  - Export targets used (cursor, agents-md, etc.)')
    console.log('  - Align content hashes (no code, no paths, no PII)\n')
    console.log('What we never collect:')
    console.log('  - Repository names or paths')
    console.log('  - Rule content or guidance text')
    console.log('  - File paths or directory structures')
    console.log('  - Any personally identifiable information\n')
    console.log('Default: disabled (opt-in only)')
    process.exit(0)
  }

  const subcommand = args[0]

  switch (subcommand) {
    case 'on':
      await telemetryOn()
      break
    case 'off':
      await telemetryOff()
      break
    case 'status':
      await telemetryStatus()
      break
    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      console.error('Run: aligntrue telemetry --help')
      process.exit(1)
  }
}

async function telemetryOn(): Promise<void> {
  try {
    writeTelemetryConfig({ enabled: true })
    recordEvent({ command_name: 'telemetry-on', align_hashes_used: [] })
    console.log('✓ Telemetry enabled')
    console.log('\nThank you for helping improve AlignTrue!')
    console.log('We collect only anonymous usage data:')
    console.log('  - Commands used')
    console.log('  - Export targets')
    console.log('  - Content hashes (no code/paths/PII)')
    console.log('\nTo disable: aligntrue telemetry off')
    process.exit(0)
  } catch (err) {
    exitWithError(Errors.operationFailed(
      'Enable telemetry',
      err instanceof Error ? err.message : String(err)
    ))
  }
}

async function telemetryOff(): Promise<void> {
  try {
    recordEvent({ command_name: 'telemetry-off', align_hashes_used: [] })
    writeTelemetryConfig({ enabled: false })
    console.log('✓ Telemetry disabled')
    console.log('\nNo usage data will be collected.')
    console.log('To re-enable: aligntrue telemetry on')
    process.exit(0)
  } catch (err) {
    exitWithError(Errors.operationFailed(
      'Disable telemetry',
      err instanceof Error ? err.message : String(err)
    ))
  }
}

async function telemetryStatus(): Promise<void> {
  try {
    const config = readTelemetryConfig()
    recordEvent({ command_name: 'telemetry-status', align_hashes_used: [] })
    
    console.log(`Telemetry: ${config.enabled ? 'enabled' : 'disabled'}`)
    
    if (config.enabled) {
      console.log('\nCollecting anonymous usage data.')
      console.log('To disable: aligntrue telemetry off')
    } else {
      console.log('\nNo usage data is being collected.')
      console.log('To enable: aligntrue telemetry on')
    }
    process.exit(0)
  } catch (err) {
    exitWithError(Errors.operationFailed(
      'Read telemetry status',
      err instanceof Error ? err.message : String(err)
    ))
  }
}

/**
 * Read telemetry config (default: disabled)
 */
function readTelemetryConfig(): TelemetryConfig {
  if (!existsSync(TELEMETRY_PATH)) {
    return { enabled: false }
  }

  try {
    const content = readFileSync(TELEMETRY_PATH, 'utf-8')
    const config = JSON.parse(content) as TelemetryConfig
    return config
  } catch (err) {
    // If parse fails, default to disabled
    console.warn('Warning: Invalid telemetry.json, defaulting to disabled')
    return { enabled: false }
  }
}

/**
 * Write telemetry config atomically
 */
function writeTelemetryConfig(config: TelemetryConfig): void {
  // Ensure directory exists
  mkdirSync(dirname(TELEMETRY_PATH), { recursive: true })

  // Write atomically (temp + rename pattern)
  const content = JSON.stringify(config, null, 2) + '\n'
  const tempPath = `${TELEMETRY_PATH}.tmp`

  writeFileSync(tempPath, content, 'utf-8')
  renameSync(tempPath, TELEMETRY_PATH)
}

