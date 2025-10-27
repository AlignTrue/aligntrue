/**
 * Tests for command_runner check
 * 
 * Note: Actual command execution tests are limited in test environment.
 * These tests focus on the execution gating logic.
 */

import { describe, it, expect } from 'vitest'
import { runCommandRunnerCheck } from '../../src/runners/command-runner.js'
import { MemoryFileProvider } from '../providers/memory.js'
import type { AlignRule } from '@aligntrue/schema'
import type { CheckContext } from '../../src/types.js'

describe('runCommandRunnerCheck', () => {
  const createRule = (overrides = {}): AlignRule => ({
    id: 'test-command',
    severity: 'error',
    check: {
      type: 'command_runner',
      inputs: {
        command: 'echo "test"',
        timeout_ms: 5000,
      },
      evidence: 'Command failed',
    },
    ...overrides,
  })

  const createContext = (provider: MemoryFileProvider, allowExec = false): CheckContext => ({
    fileProvider: provider,
    workingDir: '/test',
    executionConfig: { allowExec },
  })

  it('fails when execution is not allowed', async () => {
    const provider = new MemoryFileProvider()
    const rule = createRule()
    const context = createContext(provider, false)
    const result = await runCommandRunnerCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].message).toContain('Command execution not allowed')
    expect(result.findings[0].message).toContain('--allow-exec')
  })

  it('extracts inputs correctly', async () => {
    const provider = new MemoryFileProvider()
    const rule = createRule({
      check: {
        type: 'command_runner',
        inputs: {
          command: 'test-command',
          working_dir: '/custom/dir',
          timeout_ms: 5000,
          expect_exit_code: 0,
        },
        evidence: 'Command failed',
      },
    })

    const context = createContext(provider, false)
    const result = await runCommandRunnerCheck(rule, 'test/pack', context)

    // Should fail due to allowExec=false, but we can verify it parsed inputs
    expect(result.pass).toBe(false)
    expect(result.findings[0].message).toContain('test-command')
  })

  it('respects working directory input', async () => {
    const provider = new MemoryFileProvider()
    const rule = createRule({
      check: {
        type: 'command_runner',
        inputs: {
          command: 'pwd',
          working_dir: '/custom',
        },
        evidence: 'Command failed',
      },
    })

    const context = createContext(provider, false)
    const result = await runCommandRunnerCheck(rule, 'test/pack', context)

    expect(result.findings[0].message).toContain('pwd')
  })

  it('uses default exit code of 0 when not specified', async () => {
    const provider = new MemoryFileProvider()
    const rule = createRule({
      check: {
        type: 'command_runner',
        inputs: {
          command: 'some-command',
        },
        evidence: 'Command failed',
      },
    })

    const context = createContext(provider, false)
    const result = await runCommandRunnerCheck(rule, 'test/pack', context)

    // Verify it doesn't error on missing expect_exit_code
    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
  })

  it('includes autofix hint when present', async () => {
    const provider = new MemoryFileProvider()
    const rule = createRule({
      autofix: { hint: 'Run: pnpm install to fix dependencies' },
    })

    const context = createContext(provider, false)
    const result = await runCommandRunnerCheck(rule, 'test/pack', context)

    expect(result.findings[0].autofixHint).toBe('Run: pnpm install to fix dependencies')
  })
})

