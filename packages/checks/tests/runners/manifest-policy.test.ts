/**
 * Tests for manifest_policy check runner
 */

import { describe, it, expect } from 'vitest'
import { runManifestPolicyCheck } from '../../src/runners/manifest-policy.js'
import { MemoryFileProvider } from '../providers/memory.js'
import type { AlignRule } from '@aligntrue/schema'
import type { CheckContext } from '../../src/types.js'

describe('runManifestPolicyCheck', () => {
  const createRule = (overrides = {}): AlignRule => ({
    id: 'test-manifest-policy',
    severity: 'MUST',
    check: {
      type: 'manifest_policy',
      inputs: {
        manifest: 'package.json',
        lockfile: 'pnpm-lock.yaml',
        require_pinned: true,
      },
      evidence: 'New dependency is not pinned in lockfile',
    },
    ...overrides,
  })

  const createContext = (provider: MemoryFileProvider): CheckContext => ({
    fileProvider: provider,
    workingDir: '/test',
    executionConfig: { allowExec: false },
  })

  it('passes when all dependencies are pinned', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'package.json': JSON.stringify({
        dependencies: {
          'lodash': '4.17.21',
          'react': '18.2.0',
        },
      }),
      'pnpm-lock.yaml': 'lockfile content',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it('fails when dependencies use caret ranges', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'package.json': JSON.stringify({
        dependencies: {
          'lodash': '^4.17.21',
          'react': '18.2.0',
        },
      }),
      'pnpm-lock.yaml': 'lockfile content',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].message).toContain('lodash@^4.17.21')
  })

  it('fails when dependencies use tilde ranges', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'package.json': JSON.stringify({
        devDependencies: {
          'vitest': '~1.2.0',
        },
      }),
      'pnpm-lock.yaml': 'lockfile content',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings[0].message).toContain('vitest@~1.2.0')
  })

  it('fails for wildcard versions', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'package.json': JSON.stringify({
        dependencies: {
          'some-pkg': '*',
        },
      }),
      'pnpm-lock.yaml': 'lockfile content',
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings[0].message).toContain('some-pkg@*')
  })

  it('fails when manifest file is missing', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({})

    const rule = createRule()
    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings[0].message).toContain('Manifest file not found')
  })

  it('fails when lockfile is missing and require_pinned is true', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'package.json': JSON.stringify({ dependencies: {} }),
    })

    const rule = createRule()
    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(false)
    expect(result.findings[0].message).toContain('Lockfile not found')
  })

  it('allows missing lockfile when require_pinned is false', async () => {
    const provider = new MemoryFileProvider()
    provider.addFiles({
      'package.json': JSON.stringify({
        dependencies: {
          'lodash': '4.17.21',
        },
      }),
    })

    const rule = createRule({
      check: {
        type: 'manifest_policy',
        inputs: {
          manifest: 'package.json',
          lockfile: 'pnpm-lock.yaml',
          require_pinned: false,
        },
        evidence: 'Check manifest',
      },
    })

    const context = createContext(provider)
    const result = await runManifestPolicyCheck(rule, 'test/pack', context)

    expect(result.pass).toBe(true)
  })
})

