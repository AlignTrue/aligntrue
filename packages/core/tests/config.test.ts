import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { loadConfig, validateConfig, applyDefaults, type AlignTrueConfig } from '../src/config/index.js'

const TEST_DIR = join(process.cwd(), 'temp-config-test')

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
  vi.restoreAllMocks()
})

function writeConfig(filename: string, content: string): string {
  const path = join(TEST_DIR, filename)
  writeFileSync(path, content, 'utf8')
  return path
}

describe('Config Loading', () => {
  it('loads valid solo config with all fields', async () => {
    const configPath = writeConfig('config.yaml', `
version: "1"
mode: solo
modules:
  lockfile: false
  bundle: false
  checks: true
  mcp: false
git:
  mode: ignore
exporters:
  - cursor
  - agents-md
sources:
  - type: local
    path: .aligntrue/rules.md
`)
    
    const config = await loadConfig(configPath)
    expect(config.mode).toBe('solo')
    expect(config.version).toBe('1')
    expect(config.modules?.lockfile).toBe(false)
    expect(config.exporters).toEqual(['cursor', 'agents-md'])
  })

  it('loads valid team config', async () => {
    const configPath = writeConfig('team.yaml', `
version: "1"
mode: team
`)
    
    const config = await loadConfig(configPath)
    expect(config.mode).toBe('team')
    expect(config.modules?.lockfile).toBe(true) // team default
    expect(config.modules?.bundle).toBe(true) // team default
  })

  it('loads minimal config (only version + mode)', async () => {
    const configPath = writeConfig('minimal.yaml', `
version: "1"
mode: solo
`)
    
    const config = await loadConfig(configPath)
    expect(config.version).toBe('1')
    expect(config.mode).toBe('solo')
    expect(config.exporters).toEqual(['cursor', 'agents-md']) // default
  })

  it('applies solo defaults correctly', async () => {
    const configPath = writeConfig('solo-defaults.yaml', `
version: "1"
mode: solo
`)
    
    const config = await loadConfig(configPath)
    expect(config.modules?.lockfile).toBe(false)
    expect(config.modules?.bundle).toBe(false)
    expect(config.modules?.checks).toBe(true)
    expect(config.modules?.mcp).toBe(false)
    expect(config.git?.mode).toBe('ignore')
    expect(config.exporters).toEqual(['cursor', 'agents-md'])
    expect(config.sources).toHaveLength(1)
    expect(config.sources![0].type).toBe('local')
  })

  it('applies team defaults correctly', async () => {
    const configPath = writeConfig('team-defaults.yaml', `
version: "1"
mode: team
`)
    
    const config = await loadConfig(configPath)
    expect(config.modules?.lockfile).toBe(true)
    expect(config.modules?.bundle).toBe(true)
    expect(config.modules?.checks).toBe(true)
    expect(config.git?.mode).toBe('ignore')
  })

  it('applies enterprise defaults correctly', async () => {
    const configPath = writeConfig('enterprise-defaults.yaml', `
version: "1"
mode: enterprise
`)
    
    const config = await loadConfig(configPath)
    expect(config.modules?.lockfile).toBe(true)
    expect(config.modules?.bundle).toBe(true)
    expect(config.modules?.checks).toBe(true)
    expect(config.modules?.mcp).toBe(true)
    expect(config.git?.mode).toBe('commit')
  })

  it('throws on missing file with helpful error', async () => {
    const missingPath = join(TEST_DIR, 'missing.yaml')
    
    await expect(loadConfig(missingPath)).rejects.toThrow(/Config file not found/)
    await expect(loadConfig(missingPath)).rejects.toThrow(/aligntrue init/)
  })

  it('throws on invalid YAML with line number', async () => {
    const configPath = writeConfig('invalid.yaml', `
version: "1"
mode: solo
bad: indentation:
  nested
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/Invalid YAML/)
    await expect(loadConfig(configPath)).rejects.toThrow(/line/)
  })
})

describe('Schema Validation', () => {
  it('rejects invalid mode', async () => {
    const configPath = writeConfig('invalid-mode.yaml', `
version: "1"
mode: invalid-mode
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/mode/)
    await expect(loadConfig(configPath)).rejects.toThrow(/solo, team, enterprise/)
  })

  it('rejects invalid git mode', async () => {
    const configPath = writeConfig('invalid-git.yaml', `
version: "1"
mode: solo
git:
  mode: invalid
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/git/)
    await expect(loadConfig(configPath)).rejects.toThrow(/ignore, commit, branch/)
  })

  it('rejects invalid source type', async () => {
    const configPath = writeConfig('invalid-source.yaml', `
version: "1"
mode: solo
sources:
  - type: invalid
    path: test.md
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/type/)
  })

  it('rejects non-array exporters', async () => {
    const configPath = writeConfig('invalid-exporters.yaml', `
version: "1"
mode: solo
exporters: cursor
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/array/)
  })

  it('rejects non-boolean module flags', async () => {
    const configPath = writeConfig('invalid-module.yaml', `
version: "1"
mode: solo
modules:
  lockfile: "true"
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/boolean/)
  })

  it('accepts valid config with all optional fields', async () => {
    const configPath = writeConfig('all-fields.yaml', `
version: "1"
mode: team
modules:
  lockfile: true
  bundle: true
  checks: true
  mcp: false
git:
  mode: commit
  per_adapter:
    cursor: ignore
exporters:
  - cursor
  - agents-md
sources:
  - type: local
    path: .aligntrue/rules.md
  - type: catalog
    id: packs/base/testing
    version: "^1.0.0"
scopes:
  - path: packages/frontend
    include: ["src/**/*.tsx"]
    exclude: ["**/*.test.tsx"]
    rulesets: ["react-rules"]
merge:
  strategy: deep
  order: [root, path, local]
`)
    
    const config = await loadConfig(configPath)
    expect(config.mode).toBe('team')
    expect(config.scopes).toHaveLength(1)
    expect(config.merge?.order).toEqual(['root', 'path', 'local'])
  })

  it('validates merge.order enum values', async () => {
    const configPath = writeConfig('invalid-merge-order.yaml', `
version: "1"
mode: solo
merge:
  order: [root, invalid, local]
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/merge/)
    await expect(loadConfig(configPath)).rejects.toThrow(/root, path, local/)
  })

  it('validates scopes array structure', async () => {
    const configPath = writeConfig('invalid-scope.yaml', `
version: "1"
mode: solo
scopes:
  - path: packages/frontend
    include: "not-an-array"
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/array/)
  })

  it('handles empty config sections gracefully', async () => {
    const configPath = writeConfig('empty-sections.yaml', `
version: "1"
mode: solo
modules: {}
git: {}
`)
    
    const config = await loadConfig(configPath)
    expect(config.modules).toBeDefined()
    expect(config.git).toBeDefined()
  })

  it('schema validation error messages are actionable', async () => {
    const configPath = writeConfig('missing-required.yaml', `
mode: solo
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/version/)
    await expect(loadConfig(configPath)).rejects.toThrow(/required/)
  })
})

describe('Default Application', () => {
  it('solo mode gets correct defaults', () => {
    const config: AlignTrueConfig = {
      version: '1',
      mode: 'solo',
    }
    
    const withDefaults = applyDefaults(config)
    expect(withDefaults.modules?.lockfile).toBe(false)
    expect(withDefaults.modules?.bundle).toBe(false)
    expect(withDefaults.modules?.checks).toBe(true)
    expect(withDefaults.git?.mode).toBe('ignore')
    expect(withDefaults.exporters).toEqual(['cursor', 'agents-md'])
  })

  it('team mode overrides lockfile/bundle', () => {
    const config: AlignTrueConfig = {
      version: '1',
      mode: 'team',
    }
    
    const withDefaults = applyDefaults(config)
    expect(withDefaults.modules?.lockfile).toBe(true)
    expect(withDefaults.modules?.bundle).toBe(true)
  })

  it('user values override defaults', () => {
    const config: AlignTrueConfig = {
      version: '1',
      mode: 'solo',
      modules: {
        lockfile: true, // explicit override
      },
      exporters: ['cursor'], // explicit override
    }
    
    const withDefaults = applyDefaults(config)
    expect(withDefaults.modules?.lockfile).toBe(true) // user value preserved
    expect(withDefaults.exporters).toEqual(['cursor']) // user value preserved
  })

  it('empty exporters gets default [cursor, agents-md]', () => {
    const config: AlignTrueConfig = {
      version: '1',
      mode: 'solo',
      exporters: [],
    }
    
    const withDefaults = applyDefaults(config)
    expect(withDefaults.exporters).toEqual(['cursor', 'agents-md'])
  })

  it('empty sources gets default local source', () => {
    const config: AlignTrueConfig = {
      version: '1',
      mode: 'solo',
      sources: [],
    }
    
    const withDefaults = applyDefaults(config)
    expect(withDefaults.sources).toHaveLength(1)
    expect(withDefaults.sources![0].type).toBe('local')
    expect(withDefaults.sources![0].path).toBe('.aligntrue/rules.md')
  })

  it('merge preserves user-specified fields', () => {
    const config: AlignTrueConfig = {
      version: '1',
      mode: 'solo',
      git: {
        mode: 'commit', // user override
      },
    }
    
    const withDefaults = applyDefaults(config)
    expect(withDefaults.git?.mode).toBe('commit') // user value preserved
  })
})

describe('Warning Tests', () => {
  it('unknown top-level field triggers warning', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const configPath = writeConfig('unknown-field.yaml', `
version: "1"
mode: solo
unknownField: value
`)
    
    await loadConfig(configPath)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown config field "unknownField"')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Valid fields:')
    )
  })

  it('nested unknown field rejected by schema', async () => {
    const configPath = writeConfig('unknown-nested.yaml', `
version: "1"
mode: solo
git:
  mode: ignore
  unknownNested: value
`)
    
    // Schema validation rejects additional properties in strict objects
    await expect(loadConfig(configPath)).rejects.toThrow(/additional properties/)
  })

  it('multiple unknown fields trigger multiple warnings', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const configPath = writeConfig('multiple-unknown.yaml', `
version: "1"
mode: solo
unknown1: value1
unknown2: value2
`)
    
    await loadConfig(configPath)
    expect(consoleSpy).toHaveBeenCalledTimes(2)
  })

  it('warnings do not prevent loading', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const configPath = writeConfig('warning-loads.yaml', `
version: "1"
mode: solo
unknownField: value
`)
    
    const config = await loadConfig(configPath)
    expect(config.mode).toBe('solo')
    expect(consoleSpy).toHaveBeenCalled()
  })
})

describe('Integration with Existing Validation', () => {
  it('scope validation still works', async () => {
    const configPath = writeConfig('scope-validation.yaml', `
version: "1"
mode: solo
scopes:
  - path: ../invalid
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/path/)
  })

  it('path traversal checks still work', async () => {
    const configPath = writeConfig('path-traversal.yaml', `
version: "1"
mode: solo
scopes:
  - path: ../../etc/passwd
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow()
  })

  it('glob pattern validation still works', async () => {
    const configPath = writeConfig('glob-validation.yaml', `
version: "1"
mode: solo
scopes:
  - path: packages/frontend
    include: ["**/*.tsx"]
`)
    
    const config = await loadConfig(configPath)
    expect(config.scopes![0].include).toEqual(['**/*.tsx'])
  })

  it('merge order validation still works', async () => {
    const configPath = writeConfig('merge-order.yaml', `
version: "1"
mode: solo
merge:
  order: [root, path, local, root]
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/duplicate/)
  })

  it('cross-field validation works', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const configPath = writeConfig('cross-field.yaml', `
version: "1"
mode: solo
modules:
  lockfile: true
`)
    
    await loadConfig(configPath)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Solo mode with lockfile enabled is unusual')
    )
  })

  it('mode-specific validation works', async () => {
    const configPath = writeConfig('mode-validation.yaml', `
version: "1"
mode: team
`)
    
    const config = await loadConfig(configPath)
    expect(config.modules?.lockfile).toBe(true)
    expect(config.modules?.bundle).toBe(true)
  })
})

describe('Edge Cases', () => {
  it('config with no exporters + solo mode gets defaults', async () => {
    const configPath = writeConfig('no-exporters.yaml', `
version: "1"
mode: solo
`)
    
    const config = await loadConfig(configPath)
    expect(config.exporters).toEqual(['cursor', 'agents-md'])
  })

  it('config with explicit null fields', async () => {
    const configPath = writeConfig('null-fields.yaml', `
version: "1"
mode: solo
modules: null
`)
    
    // Schema validation should handle null appropriately
    await expect(loadConfig(configPath)).rejects.toThrow()
  })

  it('config with undefined optional fields', async () => {
    const configPath = writeConfig('undefined-fields.yaml', `
version: "1"
mode: solo
`)
    
    const config = await loadConfig(configPath)
    expect(config.version).toBe('1')
    expect(config.mode).toBe('solo')
  })

  it('large config file (performance sanity)', async () => {
    const largeScopes = Array.from({ length: 100 }, (_, i) => ({
      path: `packages/pkg-${i}`,
      include: ['src/**/*.ts'],
    }))
    
    const configPath = writeConfig('large.yaml', `
version: "1"
mode: solo
scopes:
${largeScopes.map(s => `  - path: ${s.path}\n    include: ${JSON.stringify(s.include)}`).join('\n')}
`)
    
    const start = Date.now()
    const config = await loadConfig(configPath)
    const duration = Date.now() - start
    
    expect(config.scopes).toHaveLength(100)
    expect(duration).toBeLessThan(1000) // Should load in under 1 second
  })
})

describe('Source Validation', () => {
  it('validates local source requires path', async () => {
    const configPath = writeConfig('local-no-path.yaml', `
version: "1"
mode: solo
sources:
  - type: local
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/path.*required/)
  })

  it('validates git source requires url', async () => {
    const configPath = writeConfig('git-no-url.yaml', `
version: "1"
mode: solo
sources:
  - type: git
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/url.*required/)
  })

  it('validates catalog source requires id', async () => {
    const configPath = writeConfig('catalog-no-id.yaml', `
version: "1"
mode: solo
sources:
  - type: catalog
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/id.*required/)
  })

  it('validates exporter names are non-empty', async () => {
    const configPath = writeConfig('empty-exporter.yaml', `
version: "1"
mode: solo
exporters:
  - cursor
  - ""
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/must NOT have fewer than 1 characters/)
  })
})

describe('Source Path Security Validation', () => {
  it('rejects traversal in local source paths with ../', async () => {
    const configPath = writeConfig('traversal-source.yaml', `
version: "1"
mode: solo
sources:
  - type: local
    path: ../../etc/passwd
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/parent directory traversal/)
  })

  it('accepts valid relative local source paths', async () => {
    const configPath = writeConfig('valid-source.yaml', `
version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules.md
`)
    
    const config = await loadConfig(configPath)
    expect(config.sources[0].path).toBe('.aligntrue/rules.md')
  })

  it('rejects absolute local source paths', async () => {
    const configPath = writeConfig('absolute-source.yaml', `
version: "1"
mode: solo
sources:
  - type: local
    path: /tmp/malicious.md
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/absolute paths not allowed/)
  })

  it('accepts nested relative paths in sources', async () => {
    const configPath = writeConfig('nested-source.yaml', `
version: "1"
mode: solo
sources:
  - type: local
    path: apps/web/.aligntrue/rules.md
`)
    
    const config = await loadConfig(configPath)
    expect(config.sources[0].path).toBe('apps/web/.aligntrue/rules.md')
  })

  it('rejects mixed traversal in source paths', async () => {
    const configPath = writeConfig('mixed-traversal.yaml', `
version: "1"
mode: solo
sources:
  - type: local
    path: src/../../outside/rules.md
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/parent directory traversal/)
  })

  it('accepts git sources with URLs (no path validation)', async () => {
    const configPath = writeConfig('git-source.yaml', `
version: "1"
mode: solo
sources:
  - type: git
    url: https://github.com/AlignTrue/aligns.git
`)
    
    const config = await loadConfig(configPath)
    expect(config.sources[0].url).toBe('https://github.com/AlignTrue/aligns.git')
  })

  it('accepts catalog sources with IDs (no path validation)', async () => {
    const configPath = writeConfig('catalog-source.yaml', `
version: "1"
mode: solo
sources:
  - type: catalog
    id: packs.base.global
    version: "1.0.0"
`)
    
    const config = await loadConfig(configPath)
    expect(config.sources[0].id).toBe('packs.base.global')
  })

  it('validates each source in array independently', async () => {
    const configPath = writeConfig('multiple-sources.yaml', `
version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules.md
  - type: local
    path: ../../malicious.md
`)
    
    await expect(loadConfig(configPath)).rejects.toThrow(/parent directory traversal/)
  })
})

describe('Warning for Empty Scopes', () => {
  it('warns if scopes defined but empty', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const configPath = writeConfig('empty-scopes.yaml', `
version: "1"
mode: solo
scopes: []
`)
    
    await loadConfig(configPath)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('scopes')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('empty')
    )
  })
})

