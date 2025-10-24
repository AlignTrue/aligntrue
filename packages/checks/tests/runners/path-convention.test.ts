/**
 * Tests for path_convention check runner
 */

import { describe, it, expect } from 'vitest'
import { runPathConventionCheck } from '../../src/runners/path-convention.js'
import { MemoryFileProvider } from '../providers/memory.js'
import type { AlignRule } from '@aligntrue/schema'
import type { CheckContext } from '../../src/types.js'

describe('runPathConventionCheck', () => {
  const createRule = (overrides = {}): AlignRule => ({
    id: 'test-path-convention',
    severity: 'SHOULD',
    check: {
      type: 'path_convention',
      inputs: {
        pattern: '^[a-z0-9-]+$',
        include: ['src/components/**'],
        message: 'Component files must use kebab-case',
      },
      evidence: 'File name violates path convention',
    },
    ...overrides,
  })

  const createContext = (provider: MemoryFileProvider): CheckContext => ({
    fileProvider: provider,
    workingDir: '/test',
    executionConfig: { allowExec: false },
  })

  it('passes when all files match convention', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/components/button.tsx': 'content',
      'src/components/input-field.tsx': 'content',
    })

    const rule = createRule({
      check: {
        type: 'path_convention',
        inputs: {
          pattern: '^[a-z0-9-]+\\.tsx$',
          include: ['src/components/**'],
          message: 'Component files must use kebab-case',
        },
        evidence: 'File name violates path convention',
      },
    })
    const context = createContext(provider)
    const result = await runPathConventionCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it('fails when files violate convention', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/components/Button.tsx': 'PascalCase not allowed',
      'src/components/input_field.tsx': 'snake_case not allowed',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runPathConventionCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(2)
    expect(result.findings[0].message).toContain('Component files must use kebab-case')
  })

  it('checks only filename, not full path', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/CamelCaseDir/kebab-file.tsx': 'content',
    })

    const rule = createRule({
      check: {
        type: 'path_convention',
        inputs: {
          pattern: '^[a-z0-9-]+\\.(tsx|ts)$',
          include: ['src/**'],
          message: 'Files must use kebab-case',
        },
        evidence: 'Convention violation',
      },
    })

    const context = createContext(provider)
    const result = await runPathConventionCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
  })

  it('includes autofix hint when present', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/components/BadName.tsx': 'content',
    })

    const rule = createRule({
      autofix: { hint: 'Rename to kebab-case format' },
    })

    const context = createContext(provider)
    const result = await runPathConventionCheck(rule, 'test/pack', context)

    expect(result.findings[0].autofixHint).toBe('Rename to kebab-case format')
  })
})

