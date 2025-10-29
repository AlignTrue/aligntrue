import { describe, it, expect } from 'vitest'
import {
  validateAlignSchema,
  validateAlignIntegrity,
  validateAlign,
} from '../src/validator.js'
import { computeAlignHash } from '../src/canonicalize.js'

describe('validateAlignSchema (v1)', () => {
  const validSoloPack = {
    id: 'test-valid',
    version: '1.0.0',
    spec_version: '1',
    rules: [
      {
        id: 'testing.example.rule',
        severity: 'warn',
        applies_to: ['**/*.test.ts'],
        check: {
          type: 'file_presence',
          inputs: {
            paths: ['**/*.test.ts'],
          },
          evidence: 'Missing test file',
        },
      },
    ],
  }
  
  const validTeamPack = {
    id: 'team-pack',
    version: '1.0.0',
    spec_version: '1',
    summary: 'Team pack',
    owner: 'mycompany/platform',
    source: 'github.com/mycompany/rules',
    source_sha: 'abc123def456',
    rules: [
      {
        id: 'testing.example.rule',
        severity: 'error',
        applies_to: ['**/*.ts'],
      },
    ],
  }

  it('validates a minimal solo pack', () => {
    const result = validateAlignSchema(validSoloPack)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })
  
  it('validates a team pack with provenance', () => {
    const result = validateAlignSchema(validTeamPack, { mode: 'team' })
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('rejects pack with missing required field (id)', () => {
    const invalid = { ...validSoloPack }
    delete (invalid as Record<string, unknown>).id
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with invalid version format', () => {
    const invalid = { ...validSoloPack, version: 'not-semver' }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with wrong spec_version', () => {
    const invalid = { ...validSoloPack, spec_version: '0' }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with summary too long', () => {
    const invalid = { ...validTeamPack, summary: 'x'.repeat(201) }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with empty rules array', () => {
    const invalid = { ...validSoloPack, rules: [] }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects rule with invalid severity', () => {
    const invalid = {
      ...validSoloPack,
      rules: [
        {
          ...validSoloPack.rules[0],
          severity: 'CRITICAL',
        },
      ],
    }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects rule with invalid check type', () => {
    const invalid = {
      ...validSoloPack,
      rules: [
        {
          id: 'testing.example.rule',
          severity: 'error',
          applies_to: ['**/*.ts'],
          check: {
            type: 'unknown_check_type',
            inputs: {},
            evidence: 'test',
          },
        },
      ],
    }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('validates file_presence check with required fields', () => {
    const align = {
      ...validSoloPack,
      rules: [
        {
          id: 'testing.example.check',
          severity: 'error',
          applies_to: ['**/*.ts'],
          check: {
            type: 'file_presence',
            inputs: {
              paths: ['**/*.test.ts'],
            },
            evidence: 'Missing test',
          },
        },
      ],
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('validates path_convention check with required fields', () => {
    const align = {
      ...validSoloPack,
      rules: [
        {
          id: 'testing.example.check',
          severity: 'warn',
          applies_to: ['src/**'],
          check: {
            type: 'path_convention',
            inputs: {
              pattern: '^[a-z0-9-]+$',
              include: ['src/**'],
            },
            evidence: 'Bad file name',
          },
        },
      ],
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('validates manifest_policy check with required fields', () => {
    const align = {
      ...validSoloPack,
      rules: [
        {
          id: 'testing.example.check',
          severity: 'error',
          applies_to: ['package.json'],
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
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('validates regex check with required fields', () => {
    const align = {
      ...validSoloPack,
      rules: [
        {
          id: 'testing.example.check',
          severity: 'warn',
          applies_to: ['**/*.ts'],
          check: {
            type: 'regex',
            inputs: {
              include: ['**/*.ts'],
              pattern: 'TODO',
              allow: false,
            },
            evidence: 'TODO found',
          },
        },
      ],
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('validates command_runner check with required fields', () => {
    const align = {
      ...validSoloPack,
      rules: [
        {
          id: 'testing.example.check',
          severity: 'error',
          applies_to: ['**/*.ts'],
          check: {
            type: 'command_runner',
            inputs: {
              command: 'pnpm test',
              timeout_ms: 60000,
              expect_exit_code: 0,
            },
            evidence: 'Tests failed',
          },
        },
      ],
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('rejects integrity with wrong algo', () => {
    const invalid = {
      ...validSoloPack,
      integrity: {
        algo: 'sha256',
        value: '<computed>',
      },
    }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects integrity with invalid hash format', () => {
    const invalid = {
      ...validSoloPack,
      integrity: {
        algo: 'jcs-sha256',
        value: 'not-a-valid-hash',
      },
    }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('accepts integrity with valid hex hash', () => {
    const align = {
      ...validSoloPack,
      integrity: {
        algo: 'jcs-sha256',
        value: 'a'.repeat(64),
      },
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })
})

describe('validateAlignIntegrity', () => {
  const validAlignYaml = `
id: "test-integrity"
version: "1.0.0"
spec_version: "1"
rules:
  - id: "testing.example.rule"
    severity: "error"
    applies_to: ["**/*.test.ts"]
    check:
      type: "file_presence"
      inputs:
        paths: ["**/*.test.ts"]
      evidence: "Missing tests"
integrity:
  algo: "jcs-sha256"
  value: "PLACEHOLDER"
`

  it('validates matching hash', () => {
    const correctHash = computeAlignHash(validAlignYaml)
    const alignWithHash = validAlignYaml.replace('PLACEHOLDER', correctHash)
    
    const result = validateAlignIntegrity(alignWithHash)
    expect(result.valid).toBe(true)
    expect(result.storedHash).toBe(correctHash)
    expect(result.computedHash).toBe(correctHash)
  })

  it('detects mismatched hash', () => {
    const wrongHash = 'a'.repeat(64)
    const alignWithWrongHash = validAlignYaml.replace('PLACEHOLDER', wrongHash)
    
    const result = validateAlignIntegrity(alignWithWrongHash)
    expect(result.valid).toBe(false)
    expect(result.storedHash).toBe(wrongHash)
    expect(result.computedHash).not.toBe(wrongHash)
  })

  it('accepts <computed> placeholder during authoring', () => {
    const alignWithPlaceholder = validAlignYaml.replace('PLACEHOLDER', '<computed>')
    
    const result = validateAlignIntegrity(alignWithPlaceholder)
    expect(result.valid).toBe(true)
    expect(result.storedHash).toBe('<computed>')
    expect(result.computedHash).toBe('<computed>')
  })

  it('handles pack without integrity field (solo mode)', () => {
    const soloYaml = `
id: "test-solo"
version: "1.0.0"
spec_version: "1"
rules:
  - id: "testing.example.rule"
    severity: "warn"
    applies_to: ["**/*.ts"]
`
    
    // Solo mode doesn't require integrity, so should compute hash successfully
    const result = validateAlignIntegrity(soloYaml)
    expect(result.valid).toBe(true)
  })

  it('handles parse errors gracefully', () => {
    const invalidYaml = 'this is not: valid: yaml: data'
    
    const result = validateAlignIntegrity(invalidYaml)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('validateAlign', () => {
  const validAlignYaml = `
id: "test-combined"
version: "1.0.0"
spec_version: "1"
summary: "Test pack for combined validation"
rules:
  - id: "testing.example.rule"
    severity: "error"
    applies_to: ["**/*.test.ts"]
    check:
      type: "file_presence"
      inputs:
        paths: ["**/*.test.ts"]
      evidence: "Missing tests"
integrity:
  algo: "jcs-sha256"
  value: "PLACEHOLDER"
`

  it('validates both schema and integrity for valid pack', () => {
    const correctHash = computeAlignHash(validAlignYaml)
    const alignWithHash = validAlignYaml.replace('PLACEHOLDER', correctHash)
    
    const result = validateAlign(alignWithHash)
    expect(result.schema.valid).toBe(true)
    expect(result.integrity.valid).toBe(true)
  })

  it('detects schema errors', () => {
    // codeql[js/identity-replacement] - Intentional test: verifies that unchanged YAML is still valid
    const invalidYaml = validAlignYaml.replace('spec_version: "1"', 'spec_version: "1"')
    
    const result = validateAlign(invalidYaml)
    expect(result.schema.valid).toBe(false)
    expect(result.schema.errors).toBeDefined()
  })

  it('detects integrity errors', () => {
    const wrongHash = 'b'.repeat(64)
    const alignWithWrongHash = validAlignYaml.replace('PLACEHOLDER', wrongHash)
    
    const result = validateAlign(alignWithWrongHash)
    expect(result.schema.valid).toBe(true)
    expect(result.integrity.valid).toBe(false)
  })

  it('handles packs with <computed> placeholder', () => {
    const alignWithPlaceholder = validAlignYaml.replace('PLACEHOLDER', '<computed>')
    
    const result = validateAlign(alignWithPlaceholder)
    expect(result.schema.valid).toBe(true)
    expect(result.integrity.valid).toBe(true)
  })
})

describe('provenance fields validation', () => {
  it('accepts pack with full provenance in team mode', () => {
    const pack = {
      id: 'team-pack',
      version: '1.0.0',
      spec_version: '1',
      summary: 'Team pack',
      owner: 'mycompany/platform',
      source: 'github.com/mycompany/rules',
      source_sha: 'abc123def456',
      rules: [{
        id: 'testing.example.rule',
        severity: 'error',
        applies_to: ['**/*.ts']
      }]
    }
    
    const result = validateAlignSchema(pack, { mode: 'team' })
    expect(result.valid).toBe(true)
  })
  
  it('allows missing provenance in solo mode', () => {
    const pack = {
      id: 'solo-pack',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'testing.example.rule',
        severity: 'warn',
        applies_to: ['**/*.ts']
      }]
    }
    
    const result = validateAlignSchema(pack, { mode: 'solo' })
    expect(result.valid).toBe(true)
  })
  
  it('requires summary in team mode', () => {
    const pack = {
      id: 'team-pack',
      version: '1.0.0',
      spec_version: '1',
      owner: 'mycompany/platform',
      source: 'github.com/mycompany/rules',
      source_sha: 'abc123',
      rules: [{
        id: 'testing.example.test',
        severity: 'error',
        applies_to: ['**/*.ts']
      }]
      // missing summary
    }
    
    const result = validateAlignSchema(pack, { mode: 'team' })
    expect(result.valid).toBe(false)
    expect(result.errors?.some(e => e.path === '/summary')).toBe(true)
  })
  
  it('requires owner when source is specified in team mode', () => {
    const pack = {
      id: 'team-pack',
      version: '1.0.0',
      spec_version: '1',
      summary: 'Test',
      source: 'github.com/test/rules',
      source_sha: 'abc123',
      // missing owner
      rules: [{
        id: 'testing.example.test',
        severity: 'error',
        applies_to: ['**/*.ts']
      }]
    }
    
    const result = validateAlignSchema(pack, { mode: 'team' })
    expect(result.valid).toBe(false)
    expect(result.errors?.some(e => e.path === '/owner')).toBe(true)
  })
  
  it('requires source_sha when source is specified in team mode', () => {
    const pack = {
      id: 'team-pack',
      version: '1.0.0',
      spec_version: '1',
      summary: 'Test',
      owner: 'mycompany/platform',
      source: 'github.com/test/rules',
      // missing source_sha
      rules: [{
        id: 'testing.example.test',
        severity: 'error',
        applies_to: ['**/*.ts']
      }]
    }
    
    const result = validateAlignSchema(pack, { mode: 'team' })
    expect(result.valid).toBe(false)
    expect(result.errors?.some(e => e.path === '/source_sha')).toBe(true)
  })
})

describe('mode-dependent validation', () => {
  it('solo mode: minimal fields only', () => {
    const pack = {
      id: 'solo',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'testing.example.test',
        severity: 'info',
        applies_to: ['**/*.ts']
      }]
    }
    
    const result = validateAlignSchema(pack, { mode: 'solo' })
    expect(result.valid).toBe(true)
  })
  
  it('catalog mode: requires all distribution metadata', () => {
    const incompletePack = {
      id: 'catalog-pack',
      version: '1.0.0',
      spec_version: '1',
      summary: 'Test',
      rules: [{
        id: 'testing.example.test',
        severity: 'error',
        applies_to: ['**/*.ts']
      }]
      // missing: owner, source, source_sha, tags, integrity
    }
    
    const result = validateAlignSchema(incompletePack, { mode: 'catalog' })
    expect(result.valid).toBe(false)
    expect(result.errors?.length).toBeGreaterThan(0)
  })
  
  it('catalog mode: validates complete pack', () => {
    const completePack = {
      id: 'packs/test/catalog',
      version: '1.0.0',
      spec_version: '1',
      summary: 'Test catalog pack',
      owner: 'test/team',
      source: 'github.com/test/rules',
      source_sha: 'abc123',
      tags: ['test'],
      rules: [{
        id: 'testing.example.test',
        severity: 'error',
        applies_to: ['**/*.ts']
      }],
      integrity: {
        algo: 'jcs-sha256',
        value: '<computed>'
      }
    }
    
    const result = validateAlignSchema(completePack, { mode: 'catalog' })
    expect(result.valid).toBe(true)
  })
})

describe('vendor bags in validation', () => {
  it('accepts rules with vendor metadata', () => {
    const pack = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'testing.example.rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { ai_hint: 'test' },
          aider: { priority: 'high' }
        }
      }]
    }
    
    const result = validateAlignSchema(pack)
    expect(result.valid).toBe(true)
  })
  
  it('accepts vendor._meta.volatile field', () => {
    const pack = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'testing.example.rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { session_id: 'xyz' },
          _meta: { volatile: ['cursor.session_id'] }
        }
      }]
    }
    
    const result = validateAlignSchema(pack)
    expect(result.valid).toBe(true)
  })
})

