/**
 * Unified config loader with standardized error handling
 * 
 * This utility consolidates config loading logic across all CLI commands,
 * ensuring consistent error messages and user experience.
 */

import { loadConfig, type AlignTrueConfig } from '@aligntrue/core'
import * as clack from '@clack/prompts'

/**
 * Load and validate AlignTrue configuration with standardized error handling
 * 
 * @param configPath - Path to config file (default: .aligntrue/config.yaml)
 * @returns Validated configuration object
 * @throws Exits process with code 2 on validation failure
 * 
 * @example
 * ```typescript
 * const config = await loadConfigWithValidation('.aligntrue/config.yaml')
 * ```
 */
export async function loadConfigWithValidation(
  configPath: string = '.aligntrue/config.yaml'
): Promise<AlignTrueConfig> {
  try {
    const config = await loadConfig(configPath)
    return config
  } catch (error) {
    // Standardized error handling for config loading failures
    clack.log.error('Failed to load configuration')
    console.error(`\nFile: ${configPath}`)
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`\nHint: Run 'aligntrue init' to create a valid config`)
    process.exit(2)
  }
}

/**
 * Load configuration without error handling (for commands that need custom handling)
 * 
 * @param configPath - Path to config file
 * @returns Validated configuration object or throws error
 */
export async function tryLoadConfig(
  configPath: string = '.aligntrue/config.yaml'
): Promise<AlignTrueConfig> {
  return loadConfig(configPath)
}

