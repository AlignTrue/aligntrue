/**
 * Interactive CLI prompts for conflict resolution
 * Supports both TTY (interactive) and non-TTY (CI) environments
 */

import * as clack from '@clack/prompts'
import type { Conflict } from './conflict-detector.js'
import { ConflictResolutionStrategy } from './conflict-detector.js'

/**
 * Options for conflict prompts
 */
export interface PromptOptions {
  interactive: boolean // false in CI or non-TTY
  defaultStrategy: ConflictResolutionStrategy
  batchMode: boolean // apply to all fields in rule
}

/**
 * Result of a conflict prompt
 */
export interface PromptResult {
  strategy: ConflictResolutionStrategy
  applyToAll: boolean
}

/**
 * Detect if we're in an interactive environment
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

/**
 * Prompt user for conflict resolution
 */
export async function promptForResolution(
  conflict: Conflict,
  options: PromptOptions
): Promise<PromptResult> {
  // Non-interactive mode: use default strategy
  if (!options.interactive) {
    return {
      strategy: options.defaultStrategy,
      applyToAll: false,
    }
  }

  // Show conflict details
  console.log(`\n⚠️  Conflict detected in rule "${conflict.ruleId}"`)
  console.log(`Field: ${conflict.field}`)
  console.log(`Agent: ${conflict.agent}`)
  console.log(``)
  console.log(`IR value:    ${JSON.stringify(conflict.irValue, null, 2)}`)
  console.log(`Agent value: ${JSON.stringify(conflict.agentValue, null, 2)}`)
  console.log(``)

  // Prompt for resolution
  const choice = await clack.select({
    message: 'How do you want to resolve this conflict?',
    options: [
      { value: 'keep_ir', label: 'Keep IR version (discard agent changes)' },
      { value: 'accept_agent', label: 'Accept agent version (overwrite IR)' },
      { value: 'show_diff', label: 'Show detailed diff' },
      { value: 'quit', label: 'Quit without changes' },
    ],
  })

  // Handle cancellation (Ctrl+C)
  if (clack.isCancel(choice)) {
    clack.cancel('Conflict resolution cancelled')
    return {
      strategy: ConflictResolutionStrategy.ABORT,
      applyToAll: false,
    }
  }

  // Handle show diff option
  if (choice === 'show_diff') {
    console.log(`\n--- Detailed Diff ---`)
    console.log(conflict.diff)
    console.log(``)
    // Ask again after showing diff
    return promptForResolution(conflict, options)
  }

  // Handle quit
  if (choice === 'quit') {
    return {
      strategy: ConflictResolutionStrategy.ABORT,
      applyToAll: false,
    }
  }

  // Map choice to strategy
  const strategyMap: Record<string, ConflictResolutionStrategy> = {
    keep_ir: ConflictResolutionStrategy.KEEP_IR,
    accept_agent: ConflictResolutionStrategy.ACCEPT_AGENT,
  }

  const strategy = strategyMap[choice as string] || ConflictResolutionStrategy.KEEP_IR

  // Ask if user wants to apply to all
  let applyToAll = false
  if (options.batchMode) {
    const batchConfirm = await clack.confirm({
      message: 'Apply this choice to all remaining conflicts for this rule?',
      initialValue: false,
    })
    
    if (clack.isCancel(batchConfirm)) {
      applyToAll = false
    } else {
      applyToAll = batchConfirm
    }
  }

  return {
    strategy,
    applyToAll,
  }
}

/**
 * Prompt for multiple conflicts, respecting batch mode
 */
export async function promptForConflicts(
  conflicts: Conflict[],
  options: PromptOptions
): Promise<Map<string, ConflictResolutionStrategy>> {
  const resolutions = new Map<string, ConflictResolutionStrategy>()

  // Group conflicts by rule ID
  const groupedConflicts = new Map<string, Conflict[]>()
  for (const conflict of conflicts) {
    if (!groupedConflicts.has(conflict.ruleId)) {
      groupedConflicts.set(conflict.ruleId, [])
    }
    groupedConflicts.get(conflict.ruleId)!.push(conflict)
  }

  // Process each rule's conflicts
  for (const [ruleId, ruleConflicts] of groupedConflicts) {
    let batchStrategy: ConflictResolutionStrategy | null = null

    for (const conflict of ruleConflicts) {
      // If batch mode active, use batch strategy
      if (batchStrategy !== null) {
        const key = `${conflict.ruleId}:${conflict.field}`
        resolutions.set(key, batchStrategy)
        continue
      }

      // Prompt for this conflict
      const result = await promptForResolution(conflict, options)

      // If abort, stop processing
      if (result.strategy === ConflictResolutionStrategy.ABORT) {
        throw new Error('Conflict resolution aborted by user')
      }

      // Store resolution
      const key = `${conflict.ruleId}:${conflict.field}`
      resolutions.set(key, result.strategy)

      // If apply to all, set batch strategy
      if (result.applyToAll) {
        batchStrategy = result.strategy
      }
    }
  }

  return resolutions
}

/**
 * Show checksum mismatch prompt
 */
export async function promptOnChecksumMismatch(
  filePath: string,
  lastChecksum: string,
  currentChecksum: string,
  interactive: boolean,
  force: boolean
): Promise<'overwrite' | 'keep' | 'abort'> {
  // Non-interactive with force: overwrite
  if (!interactive && force) {
    return 'overwrite'
  }

  // Non-interactive without force: abort
  if (!interactive) {
    return 'abort'
  }

  // Interactive: prompt user
  console.log(`\n⚠️  File has been manually edited: ${filePath}`)
  console.log(`Last known checksum: ${lastChecksum.slice(0, 16)}...`)
  console.log(`Current checksum:    ${currentChecksum.slice(0, 16)}...`)
  console.log(``)

  const choice = await clack.select({
    message: 'How do you want to proceed?',
    options: [
      { value: 'view', label: 'View diff' },
      { value: 'overwrite', label: 'Overwrite manual changes' },
      { value: 'keep', label: 'Keep manual changes (skip sync)' },
      { value: 'abort', label: 'Abort sync' },
    ],
  })

  // Handle cancellation
  if (clack.isCancel(choice)) {
    clack.cancel('Sync cancelled')
    return 'abort'
  }

  // Handle view diff
  if (choice === 'view') {
    // In a real implementation, we'd show the actual diff here
    console.log(`\nDiff not yet implemented (requires file content comparison)`)
    console.log(`Last checksum: ${lastChecksum}`)
    console.log(`Current:       ${currentChecksum}`)
    console.log(``)
    // Ask again after showing info
    return promptOnChecksumMismatch(filePath, lastChecksum, currentChecksum, interactive, force)
  }

  return choice as 'overwrite' | 'keep' | 'abort'
}

