/**
 * Tests for interactive conflict prompts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  promptForResolution,
  promptForConflicts,
  promptOnChecksumMismatch,
  isInteractive,
  type PromptOptions,
} from '../../src/sync/conflict-prompt.js'
import { ConflictResolutionStrategy, type Conflict } from '../../src/sync/conflict-detector.js'

// Mock the prompts library
vi.mock('prompts', () => ({
  default: vi.fn(),
}))

describe('ConflictPrompt', () => {
  let mockPrompts: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const prompts = await import('prompts')
    mockPrompts = prompts.default as ReturnType<typeof vi.fn>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('isInteractive', () => {
    it('returns true when stdin and stdout are TTY', () => {
      const originalStdinIsTTY = process.stdin.isTTY
      const originalStdoutIsTTY = process.stdout.isTTY

      process.stdin.isTTY = true
      process.stdout.isTTY = true

      expect(isInteractive()).toBe(true)

      process.stdin.isTTY = originalStdinIsTTY
      process.stdout.isTTY = originalStdoutIsTTY
    })

    it('returns false when stdin is not TTY', () => {
      const originalStdinIsTTY = process.stdin.isTTY

      process.stdin.isTTY = false

      expect(isInteractive()).toBe(false)

      process.stdin.isTTY = originalStdinIsTTY
    })
  })

  describe('promptForResolution', () => {
    const conflict: Conflict = {
      agent: 'cursor',
      ruleId: 'testing.require-tests',
      field: 'severity',
      irValue: 'warn',
      agentValue: 'error',
      diff: 'Field: severity\nIR value:\n"warn"\nAgent value:\n"error"',
    }

    it('uses default strategy in non-interactive mode', async () => {
      const options: PromptOptions = {
        interactive: false,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      const result = await promptForResolution(conflict, options)

      expect(result.strategy).toBe(ConflictResolutionStrategy.KEEP_IR)
      expect(result.applyToAll).toBe(false)
      expect(mockPrompts).not.toHaveBeenCalled()
    })

    it('prompts user in interactive mode (keep IR)', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: 'keep_ir' })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      const result = await promptForResolution(conflict, options)

      expect(result.strategy).toBe(ConflictResolutionStrategy.KEEP_IR)
      expect(mockPrompts).toHaveBeenCalledTimes(1)
    })

    it('prompts user in interactive mode (accept agent)', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: 'accept_agent' })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      const result = await promptForResolution(conflict, options)

      expect(result.strategy).toBe(ConflictResolutionStrategy.ACCEPT_AGENT)
    })

    it('handles quit option', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: 'quit' })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      const result = await promptForResolution(conflict, options)

      expect(result.strategy).toBe(ConflictResolutionStrategy.ABORT)
      expect(result.applyToAll).toBe(false)
    })

    it('handles cancelled prompt (undefined)', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: undefined })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      const result = await promptForResolution(conflict, options)

      expect(result.strategy).toBe(ConflictResolutionStrategy.ABORT)
    })

    it('prompts for batch mode when enabled', async () => {
      mockPrompts
        .mockResolvedValueOnce({ choice: 'keep_ir' })
        .mockResolvedValueOnce({ batch: true })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: true,
      }

      const result = await promptForResolution(conflict, options)

      expect(result.strategy).toBe(ConflictResolutionStrategy.KEEP_IR)
      expect(result.applyToAll).toBe(true)
      expect(mockPrompts).toHaveBeenCalledTimes(2)
    })
  })

  describe('promptForConflicts', () => {
    it('processes multiple conflicts', async () => {
      const conflicts: Conflict[] = [
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
        {
          agent: 'cursor',
          ruleId: 'style.no-any',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
      ]

      mockPrompts
        .mockResolvedValueOnce({ choice: 'keep_ir' })
        .mockResolvedValueOnce({ choice: 'accept_agent' })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      const resolutions = await promptForConflicts(conflicts, options)

      expect(resolutions.size).toBe(2)
      expect(resolutions.get('testing.require-tests:severity')).toBe(ConflictResolutionStrategy.KEEP_IR)
      expect(resolutions.get('style.no-any:severity')).toBe(ConflictResolutionStrategy.ACCEPT_AGENT)
    })

    it('applies batch strategy to remaining conflicts in rule', async () => {
      const conflicts: Conflict[] = [
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'guidance',
          irValue: 'Old guidance',
          agentValue: 'New guidance',
          diff: '',
        },
        {
          agent: 'cursor',
          ruleId: 'style.no-any',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
      ]

      // First conflict: keep_ir with batch mode
      mockPrompts
        .mockResolvedValueOnce({ choice: 'keep_ir' })
        .mockResolvedValueOnce({ batch: true })
        // Third conflict (different rule)
        .mockResolvedValueOnce({ choice: 'accept_agent' })
        .mockResolvedValueOnce({ batch: false })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: true,
      }

      const resolutions = await promptForConflicts(conflicts, options)

      expect(resolutions.size).toBe(3)
      // First two should be KEEP_IR (batch applied)
      expect(resolutions.get('testing.require-tests:severity')).toBe(ConflictResolutionStrategy.KEEP_IR)
      expect(resolutions.get('testing.require-tests:guidance')).toBe(ConflictResolutionStrategy.KEEP_IR)
      // Third is different rule, prompted separately
      expect(resolutions.get('style.no-any:severity')).toBe(ConflictResolutionStrategy.ACCEPT_AGENT)
    })

    it('throws on abort', async () => {
      const conflicts: Conflict[] = [
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
      ]

      mockPrompts.mockResolvedValueOnce({ choice: 'quit' })

      const options: PromptOptions = {
        interactive: true,
        defaultStrategy: ConflictResolutionStrategy.KEEP_IR,
        batchMode: false,
      }

      await expect(promptForConflicts(conflicts, options)).rejects.toThrow(/aborted by user/)
    })

    it('uses default strategy in non-interactive mode', async () => {
      const conflicts: Conflict[] = [
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
      ]

      const options: PromptOptions = {
        interactive: false,
        defaultStrategy: ConflictResolutionStrategy.ACCEPT_AGENT,
        batchMode: false,
      }

      const resolutions = await promptForConflicts(conflicts, options)

      expect(resolutions.size).toBe(1)
      expect(resolutions.get('testing.require-tests:severity')).toBe(ConflictResolutionStrategy.ACCEPT_AGENT)
      expect(mockPrompts).not.toHaveBeenCalled()
    })
  })

  describe('promptOnChecksumMismatch', () => {
    const filePath = '/path/to/file.txt'
    const lastChecksum = 'abc123def456'
    const currentChecksum = 'xyz789ghi012'

    it('returns overwrite in non-interactive mode with force', async () => {
      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        false,
        true
      )

      expect(result).toBe('overwrite')
      expect(mockPrompts).not.toHaveBeenCalled()
    })

    it('returns abort in non-interactive mode without force', async () => {
      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        false,
        false
      )

      expect(result).toBe('abort')
      expect(mockPrompts).not.toHaveBeenCalled()
    })

    it('prompts user in interactive mode (overwrite)', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: 'overwrite' })

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false
      )

      expect(result).toBe('overwrite')
      expect(mockPrompts).toHaveBeenCalledTimes(1)
    })

    it('prompts user in interactive mode (keep)', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: 'keep' })

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false
      )

      expect(result).toBe('keep')
    })

    it('prompts user in interactive mode (abort)', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: 'abort' })

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false
      )

      expect(result).toBe('abort')
    })

    it('handles cancelled prompt as abort', async () => {
      mockPrompts.mockResolvedValueOnce({ choice: undefined })

      const result = await promptOnChecksumMismatch(
        filePath,
        lastChecksum,
        currentChecksum,
        true,
        false
      )

      expect(result).toBe('abort')
    })
  })
})

