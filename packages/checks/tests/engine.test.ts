/**
 * Tests for the main checks engine
 */

import { describe, it, expect } from 'vitest'
import { runChecks } from '../src/engine.js'
import { MemoryFileProvider } from './providers/memory.js'
import type { AlignPack } from '@aligntrue/schema'

describe('runChecks', () => {
  const createPack = (overrides: Partial<AlignPack> = {}): AlignPack => ({
    id: 'test/pack',
    version: '1.0.0',
    profile: 'align',
    spec_version: '1',
    summary: 'Test pack',
    tags: ['test'],
    deps: [],
    scope: {
      applies_to: ['*'],
    },
    rules: [],
    integrity: {
      algo: 'jcs-sha256',
      value: 'abc123',
    },
    ...overrides,
  })

  it('runs all checks in a pack', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.test.ts': 'test content',
      'package.json': JSON.stringify({ dependencies: { lodash: '4.17.21' } }),
      'pnpm-lock.yaml': 'lock content',
    })

    const pack = createPack({
      rules: [
        {
          id: 'require-tests',
          severity: 'MUST',
          check: {
            type: 'file_presence',
            inputs: { pattern: '**/*.test.ts' },
            evidence: 'Missing tests',
          },
        },
        {
          id: 'pinned-deps',
          severity: 'MUST',
          check: {
            type: 'manifest_policy',
            inputs: {
              manifest: 'package.json',
              lockfile: 'pnpm-lock.yaml',
              require_pinned: true,
            },
            evidence: 'Unpinned dependency',
          },
        },
      ],
    })

    const results = await runChecks(pack, { fileProvider: provider })

    expect(results).toHaveLength(2)
    expect(results.every(r => r.pass)).toBe(true)
  })

  it('delegates to correct runner based on check type', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/Button.tsx': 'component',
      'src/foo.ts': 'TODO: fix this',
    })

    const pack = createPack({
      rules: [
        {
          id: 'kebab-case',
          severity: 'SHOULD',
          check: {
            type: 'path_convention',
            inputs: {
              pattern: '^[a-z-]+\\.tsx$',
              include: ['src/**/*.tsx'],
              message: 'Use kebab-case',
            },
            evidence: 'Convention violation',
          },
        },
        {
          id: 'no-todos',
          severity: 'SHOULD',
          check: {
            type: 'regex',
            inputs: {
              include: ['src/**/*.ts'],
              pattern: '\\bTODO\\b',
              allow: false,
            },
            evidence: 'TODO found',
          },
        },
      ],
    })

    const results = await runChecks(pack, { fileProvider: provider })

    expect(results).toHaveLength(2)
    expect(results[0].pass).toBe(false) // Button.tsx violates convention
    expect(results[1].pass).toBe(false) // foo.ts has TODO
  })

  it('respects allowExec option for command checks', async () => {
    const provider = new MemoryFileProvider()

    const pack = createPack({
      rules: [
        {
          id: 'typecheck',
          severity: 'MUST',
          check: {
            type: 'command_runner',
            inputs: {
              command: 'echo "test"',
            },
            evidence: 'Typecheck failed',
          },
        },
      ],
    })

    // Without allowExec
    const resultsDisallowed = await runChecks(pack, {
      fileProvider: provider,
      allowExec: false,
    })

    expect(resultsDisallowed[0].pass).toBe(false)
    expect(resultsDisallowed[0].findings[0].message).toContain('not allowed')

    // With allowExec
    const resultsAllowed = await runChecks(pack, {
      fileProvider: provider,
      allowExec: true,
    })

    expect(resultsAllowed[0].pass).toBe(true)
  })

  it('passes changed files to checks', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'src/foo.ts': 'source',
      'src/foo.test.ts': 'test',
      'src/bar.ts': 'source without test',
    })

    const pack = createPack({
      rules: [
        {
          id: 'require-tests',
          severity: 'MUST',
          check: {
            type: 'file_presence',
            inputs: {
              pattern: '**/*.test.ts',
              must_exist_for_changed_sources: true,
            },
            evidence: 'Missing test',
          },
        },
      ],
    })

    const results = await runChecks(pack, {
      fileProvider: provider,
      changedFiles: ['src/bar.ts'],
    })

    expect(results[0].pass).toBe(false)
    expect(results[0].findings[0].location.path).toBe('src/bar.ts')
  })

  it('returns results for empty pack', async () => {
    const provider = new MemoryFileProvider()
    const pack = createPack({ rules: [] })

    const results = await runChecks(pack, { fileProvider: provider })

    expect(results).toHaveLength(0)
  })

  it('handles unknown check types gracefully', async () => {
    const provider = new MemoryFileProvider()
    const pack = createPack({
      rules: [
        {
          id: 'unknown-check',
          severity: 'MUST',
          check: {
            // @ts-expect-error - testing unknown type
            type: 'unknown_type',
            inputs: {},
            evidence: 'Unknown check',
          },
        },
      ],
    })

    const results = await runChecks(pack, { fileProvider: provider })

    expect(results[0].pass).toBe(false)
    expect(results[0].error).toContain('Unknown check type')
  })
})

