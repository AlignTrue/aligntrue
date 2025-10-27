/**
 * Tests for regex check runner
 */

import { describe, it, expect } from 'vitest'
import { runRegexCheck } from '../../src/runners/regex.js'
import { MemoryFileProvider } from '../providers/memory.js'
import type { AlignRule } from '@aligntrue/schema'
import type { CheckContext } from '../../src/types.js'

describe('runRegexCheck', () => {
  const createRule = (overrides = {}): AlignRule => ({
    id: 'test-regex',
    severity: 'warn',
    check: {
      type: 'regex',
      inputs: {
        include: ['**/*.ts'],
        pattern: '\\bTODO\\b',
        allow: false,
      },
      evidence: 'TODO present in file',
    },
    ...overrides,
  })

  const createContext = (provider: MemoryFileProvider): CheckContext => ({
    fileProvider: provider,
    workingDir: '/test',
    executionConfig: { allowExec: false },
  })

  it('passes when pattern not found (allow=false)', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.ts': 'const x = 42;',
      'src/bar.ts': 'function test() {}',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runRegexCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it('fails when forbidden pattern found', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.ts': 'const x = 42; // TODO: fix this',
      'src/bar.ts': 'function test() {}',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runRegexCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].location.path).toBe('src/foo.ts')
    expect(result.findings[0].location.line).toBe(1)
  })

  it('reports multiple occurrences with line numbers', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/multi.ts': `line 1
// TODO: item 1
line 3
// TODO: item 2
line 5`,
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runRegexCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(2)
    expect(result.findings[0].location.line).toBe(2)
    expect(result.findings[1].location.line).toBe(4)
  })

  it('passes when required pattern is found (allow=true)', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.test.ts': 'describe("test", () => {})',
    })

    const rule = createRule({
      check: {
        type: 'regex',
        inputs: {
          include: ['**/*.test.ts'],
          pattern: 'describe\\(',
          allow: true,
        },
        evidence: 'Test file must contain describe block',
      },
    })

    const context = createContext(provider)
    const result = await runRegexCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it('fails when required pattern is missing (allow=true)', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.test.ts': 'it("test", () => {})',
    })

    const rule = createRule({
      check: {
        type: 'regex',
        inputs: {
          include: ['**/*.test.ts'],
          pattern: 'describe\\(',
          allow: true,
        },
        evidence: 'Test file must contain describe block',
      },
    })

    const context = createContext(provider)
    const result = await runRegexCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
  })

  it('includes autofix hint when present', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.ts': 'TODO: complete',
    })

    const rule = createRule({
      autofix: { hint: 'Remove or complete TODO items' },
    })

    const context = createContext(provider)
    const result = await runRegexCheck(rule, 'test/pack', context)

    expect(result.findings[0].autofixHint).toBe('Remove or complete TODO items')
  })
})

