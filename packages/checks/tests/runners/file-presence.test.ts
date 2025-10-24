/**
 * Tests for file_presence check runner
 */

import { describe, it, expect } from 'vitest'
import { runFilePresenceCheck } from '../../src/runners/file-presence.js'
import { MemoryFileProvider } from '../providers/memory.js'
import type { AlignRule } from '@aligntrue/schema'
import type { CheckContext } from '../../src/types.js'

describe('runFilePresenceCheck', () => {
  const createRule = (overrides = {}): AlignRule => ({
    id: 'test-file-presence',
    severity: 'MUST',
    check: {
      type: 'file_presence',
      inputs: {
        pattern: '**/*.test.ts',
      },
      evidence: 'Missing test file',
    },
    ...overrides,
  })

  const createContext = (provider: MemoryFileProvider): CheckContext => ({
    fileProvider: provider,
    workingDir: '/test',
    executionConfig: { allowExec: false },
  })

  it('passes when files matching pattern exist', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.test.ts': 'test content',
      'src/bar.test.ts': 'test content',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runFilePresenceCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it('fails when no files match pattern', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.ts': 'source content',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runFilePresenceCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].message).toContain('No files found matching pattern')
  })

  it('checks changed files when must_exist_for_changed_sources is true', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.ts': 'source',
      'src/foo.test.ts': 'test',
      'src/bar.ts': 'source without test',
    })

    const rule = createRule({
      check: {
        type: 'file_presence',
        inputs: {
          pattern: '**/*.test.ts',
          must_exist_for_changed_sources: true,
        },
        evidence: 'Missing test file for changed source',
      },
    })

    const context: CheckContext = {
      ...createContext(provider),
      changedFiles: ['src/bar.ts'],
    }

    const result = await runFilePresenceCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].location.path).toBe('src/bar.ts')
  })

  it('includes autofix hint when present', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({})

    const rule = createRule({
      autofix: { hint: 'Run: npm test -- --init' },
    })

    const context = createContext(provider)
    const result = await runFilePresenceCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings[0].autofixHint).toBe('Run: npm test -- --init')
  })

  it('returns error for type mismatch', async () => {
    const provider = new MemoryFileProvider()
    const rule = createRule({
      check: {
        type: 'regex',
        inputs: {},
        evidence: 'wrong type',
      },
    })

    const context = createContext(provider)
    const result = await runFilePresenceCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.error).toContain('Check type mismatch')
  })
})

