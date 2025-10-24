import { describe, it, expect } from 'vitest'
import {
  validateAlignSchema,
  validateAlignIntegrity,
  validateAlign,
} from '../src/validator.js'
import { computeAlignHash } from '../src/canonicalize.js'

describe('validateAlignSchema', () => {
  const validAlign = {
    id: 'packs/test/valid',
    version: '1.0.0',
    profile: 'align',
    spec_version: '1',
    summary: 'Valid test pack',
    tags: ['test'],
    deps: [],
    scope: {
      applies_to: ['*'],
    },
    rules: [
      {
        id: 'test-rule',
        severity: 'MUST',
        check: {
          type: 'file_presence',
          inputs: {
            pattern: '**/*.test.ts',
          },
          evidence: 'Missing test file',
        },
      },
    ],
    integrity: {
      algo: 'jcs-sha256',
      value: '<computed>',
    },
  }

  it('validates a correct Align pack', () => {
    const result = validateAlignSchema(validAlign)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('rejects pack with missing required field', () => {
    const invalid = { ...validAlign }
    delete (invalid as Record<string, unknown>).summary
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.some(e => e.message.includes('required'))).toBe(true)
  })

  it('rejects pack with invalid id pattern', () => {
    const invalid = { ...validAlign, id: 'invalid_id_with_underscores' }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with invalid version format', () => {
    const invalid = { ...validAlign, version: 'not-semver' }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with wrong profile value', () => {
    const invalid = { ...validAlign, profile: 'wrong' }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with wrong spec_version', () => {
    const invalid = { ...validAlign, spec_version: '2' }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with summary too long', () => {
    const invalid = { ...validAlign, summary: 'x'.repeat(201) }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with invalid tag format', () => {
    const invalid = { ...validAlign, tags: ['Valid-Tag', 'Invalid_Tag'] }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with empty tags array', () => {
    const invalid = { ...validAlign, tags: [] }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with missing scope.applies_to', () => {
    const invalid = { ...validAlign, scope: {} }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects pack with empty rules array', () => {
    const invalid = { ...validAlign, rules: [] }
    
    const result = validateAlignSchema(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('rejects rule with invalid severity', () => {
    const invalid = {
      ...validAlign,
      rules: [
        {
          ...validAlign.rules[0],
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
      ...validAlign,
      rules: [
        {
          id: 'test-rule',
          severity: 'MUST',
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
      ...validAlign,
      rules: [
        {
          id: 'test',
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
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('validates path_convention check with required fields', () => {
    const align = {
      ...validAlign,
      rules: [
        {
          id: 'test',
          severity: 'SHOULD',
          check: {
            type: 'path_convention',
            inputs: {
              pattern: '^[a-z0-9-]+$',
              include: ['src/**'],
              message: 'Use kebab-case',
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
      ...validAlign,
      rules: [
        {
          id: 'test',
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
    }
    
    const result = validateAlignSchema(align)
    expect(result.valid).toBe(true)
  })

  it('validates regex check with required fields', () => {
    const align = {
      ...validAlign,
      rules: [
        {
          id: 'test',
          severity: 'SHOULD',
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
      ...validAlign,
      rules: [
        {
          id: 'test',
          severity: 'MUST',
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
      ...validAlign,
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
      ...validAlign,
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
      ...validAlign,
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
id: "packs/test/integrity"
version: "1.0.0"
profile: "align"
spec_version: "1"
summary: "Test pack"
tags: ["test"]
deps: []
scope:
  applies_to: ["*"]
rules:
  - id: "test-rule"
    severity: "MUST"
    check:
      type: "file_presence"
      inputs:
        pattern: "**/*.test.ts"
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

  it('returns error for missing integrity field', () => {
    const invalidYaml = `
id: "packs/test/no-integrity"
version: "1.0.0"
profile: "align"
`
    
    const result = validateAlignIntegrity(invalidYaml)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing integrity field')
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
id: "packs/test/combined"
version: "1.0.0"
profile: "align"
spec_version: "1"
summary: "Test pack for combined validation"
tags: ["test"]
deps: []
scope:
  applies_to: ["*"]
rules:
  - id: "test-rule"
    severity: "MUST"
    check:
      type: "file_presence"
      inputs:
        pattern: "**/*.test.ts"
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
    const invalidYaml = validAlignYaml.replace('profile: "align"', 'profile: "wrong"')
    
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

