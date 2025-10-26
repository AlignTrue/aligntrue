import { describe, it, expect } from 'vitest'
import {
  parseYamlToJson,
  canonicalizeJson,
  computeHash,
  computeAlignHash,
  verifyAlignHash,
} from '../src/canonicalize.js'

describe('parseYamlToJson', () => {
  it('parses basic YAML to JSON', () => {
    const yaml = 'foo: bar\nbaz: 42'
    const result = parseYamlToJson(yaml)
    expect(result).toEqual({ foo: 'bar', baz: 42 })
  })

  it('resolves YAML anchors and aliases', () => {
    const yaml = `
defaults: &defaults
  timeout: 30
  retries: 3

prod:
  <<: *defaults
  env: production
`
    const result = parseYamlToJson(yaml) as Record<string, unknown>
    expect(result.prod).toEqual({
      timeout: 30,
      retries: 3,
      env: 'production',
    })
  })

  it('handles arrays', () => {
    const yaml = `
tags:
  - testing
  - paved-road
  - quality
`
    const result = parseYamlToJson(yaml)
    expect(result).toEqual({
      tags: ['testing', 'paved-road', 'quality'],
    })
  })

  it('handles empty arrays and objects', () => {
    const yaml = `
deps: []
metadata: {}
`
    const result = parseYamlToJson(yaml)
    expect(result).toEqual({
      deps: [],
      metadata: {},
    })
  })

  it('handles unicode strings', () => {
    const yaml = 'message: "Hello 世界 🌍"'
    const result = parseYamlToJson(yaml)
    expect(result).toEqual({ message: 'Hello 世界 🌍' })
  })
})

describe('canonicalizeJson', () => {
  it('produces stable key ordering', () => {
    const obj1 = { z: 1, a: 2, m: 3 }
    const obj2 = { m: 3, z: 1, a: 2 }
    
    const canon1 = canonicalizeJson(obj1)
    const canon2 = canonicalizeJson(obj2)
    
    expect(canon1).toBe(canon2)
    expect(canon1).toBe('{"a":2,"m":3,"z":1}')
  })

  it('sorts nested object keys', () => {
    const obj = {
      zebra: { foo: 1, bar: 2 },
      apple: { zed: 3, ant: 4 },
    }
    
    const canon = canonicalizeJson(obj)
    expect(canon).toBe('{"apple":{"ant":4,"zed":3},"zebra":{"bar":2,"foo":1}}')
  })

  it('preserves array order', () => {
    const obj = { items: [3, 1, 2] }
    const canon = canonicalizeJson(obj)
    expect(canon).toBe('{"items":[3,1,2]}')
  })

  it('handles floating point numbers correctly', () => {
    const obj = { value: 1.5, zero: 0.0, negative: -2.5 }
    const canon = canonicalizeJson(obj)
    expect(canon).toContain('"value":1.5')
    expect(canon).toContain('"zero":0')
  })

  it('handles boolean and null values', () => {
    const obj = { flag: true, empty: null, disabled: false }
    const canon = canonicalizeJson(obj)
    expect(canon).toBe('{"disabled":false,"empty":null,"flag":true}')
  })

  it('throws on undefined result', () => {
    // canonicalize returns undefined for functions
    expect(() => canonicalizeJson(() => {})).toThrow('Canonicalization failed')
  })
})

describe('computeHash', () => {
  it('produces SHA-256 hex hash', () => {
    const data = 'hello world'
    const hash = computeHash(data)
    
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = computeHash('foo')
    const hash2 = computeHash('bar')
    
    expect(hash1).not.toBe(hash2)
  })

  it('produces consistent hashes for same input', () => {
    const data = '{"a":1,"b":2}'
    const hash1 = computeHash(data)
    const hash2 = computeHash(data)
    
    expect(hash1).toBe(hash2)
  })

  it('handles unicode strings', () => {
    const data = '{"message":"Hello 世界"}'
    const hash = computeHash(data)
    
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('computeAlignHash', () => {
  const minimalAlign = `
id: "test-minimal"
version: "1.0.0"
spec_version: "1"
rules:
  - id: "test-rule"
    severity: "error"
    applies_to: ["**/*.test.ts"]
    check:
      type: "file_presence"
      inputs:
        paths: ["**/*.test.ts"]
      evidence: "Missing tests"
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
`

  it('computes hash for valid Align pack', () => {
    const hash = computeAlignHash(minimalAlign)
    
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces stable hash for same input', () => {
    const hash1 = computeAlignHash(minimalAlign)
    const hash2 = computeAlignHash(minimalAlign)
    
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different content', () => {
    const align2 = minimalAlign.replace('test-minimal', 'test-modified')
    const hash1 = computeAlignHash(minimalAlign)
    const hash2 = computeAlignHash(align2)
    
    expect(hash1).not.toBe(hash2)
  })

  it('ignores integrity.value when computing hash', () => {
    const align1 = minimalAlign.replace('value: "<computed>"', 'value: "abc123"')
    const align2 = minimalAlign.replace('value: "<computed>"', 'value: "xyz789"')
    
    const hash1 = computeAlignHash(align1)
    const hash2 = computeAlignHash(align2)
    
    expect(hash1).toBe(hash2)
  })

  it('handles pack without integrity field (solo mode)', () => {
    const soloAlign = `
id: "test-solo"
version: "1.0.0"
spec_version: "1"
rules:
  - id: "test-rule"
    severity: "warn"
    applies_to: ["**/*.ts"]
`
    // Should not throw - integrity is optional in solo mode
    const hash = computeAlignHash(soloAlign)
    expect(hash).toHaveLength(64)
  })

  it('handles key ordering in YAML', () => {
    // Different key ordering in YAML should produce same hash
    const align1 = `
id: "test-order"
version: "1.0.0"
spec_version: "1"
summary: "Test"
rules:
  - id: "test-rule"
    severity: "warn"
    applies_to: ["**/*.ts"]
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
`
    const align2 = `
spec_version: "1"
version: "1.0.0"
id: "test-order"
summary: "Test"
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
rules:
  - id: "test-rule"
    severity: "warn"
    applies_to: ["**/*.ts"]
`
    const hash1 = computeAlignHash(align1)
    const hash2 = computeAlignHash(align2)
    
    expect(hash1).toBe(hash2)
  })
})

describe('verifyAlignHash', () => {
  const alignWithHash = `
id: "test-verified"
version: "1.0.0"
spec_version: "1"
rules:
  - id: "test-rule"
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

  it('returns true for matching hash', () => {
    const correctHash = computeAlignHash(alignWithHash)
    const alignWithCorrectHash = alignWithHash.replace('PLACEHOLDER', correctHash)
    
    const result = verifyAlignHash(alignWithCorrectHash, correctHash)
    expect(result).toBe(true)
  })

  it('returns false for mismatched hash', () => {
    const wrongHash = 'a'.repeat(64)
    const result = verifyAlignHash(alignWithHash, wrongHash)
    expect(result).toBe(false)
  })
})

describe('vendor bag canonicalization', () => {
  it('includes vendor fields by default', () => {
    const pack = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { ai_hint: 'test' },
          aider: { priority: 'high' }
        }
      }]
    }
    
    const hash1 = computeAlignHash(pack)
    const hash2 = computeAlignHash(pack)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })
  
  it('excludes vendor.*.volatile fields from hash', () => {
    const packWithVolatile = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { 
            ai_hint: 'test',
            session_id: 'xyz'
          },
          _meta: {
            volatile: ['cursor.session_id']
          }
        }
      }]
    }
    
    const packWithDifferentVolatile = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { 
            ai_hint: 'test',
            session_id: 'abc'  // different value
          },
          _meta: {
            volatile: ['cursor.session_id']
          }
        }
      }]
    }
    
    const hash1 = computeAlignHash(packWithVolatile)
    const hash2 = computeAlignHash(packWithDifferentVolatile)
    expect(hash1).toBe(hash2)  // Hashes match despite different session_id
  })
  
  it('includes non-volatile vendor fields in hash', () => {
    const pack1 = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { 
            ai_hint: 'test1',
            session_id: 'xyz'
          },
          _meta: {
            volatile: ['cursor.session_id']
          }
        }
      }]
    }
    
    const pack2 = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { 
            ai_hint: 'test2',  // different non-volatile value
            session_id: 'xyz'
          },
          _meta: {
            volatile: ['cursor.session_id']
          }
        }
      }]
    }
    
    const hash1 = computeAlignHash(pack1)
    const hash2 = computeAlignHash(pack2)
    expect(hash1).not.toBe(hash2)  // Hashes differ due to ai_hint change
  })
  
  it('handles multiple volatile fields', () => {
    const pack1 = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { 
            ai_hint: 'test',
            session_id: 'xyz',
            timestamp: '2025-10-26T12:00:00Z'
          },
          _meta: {
            volatile: ['cursor.session_id', 'cursor.timestamp']
          }
        }
      }]
    }
    
    const pack2 = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { 
            ai_hint: 'test',
            session_id: 'abc',  // different
            timestamp: '2025-10-26T14:00:00Z'  // different
          },
          _meta: {
            volatile: ['cursor.session_id', 'cursor.timestamp']
          }
        }
      }]
    }
    
    const hash1 = computeAlignHash(pack1)
    const hash2 = computeAlignHash(pack2)
    expect(hash1).toBe(hash2)  // Both volatile fields excluded
  })
  
  it('handles volatile fields in multiple rules', () => {
    const pack1 = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [
        {
          id: 'rule-1',
          severity: 'warn',
          applies_to: ['**/*.ts'],
          vendor: {
            cursor: { session_id: 'xyz' },
            _meta: { volatile: ['cursor.session_id'] }
          }
        },
        {
          id: 'rule-2',
          severity: 'error',
          applies_to: ['**/*.js'],
          vendor: {
            aider: { context_id: '123' },
            _meta: { volatile: ['aider.context_id'] }
          }
        }
      ]
    }
    
    const pack2 = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [
        {
          id: 'rule-1',
          severity: 'warn',
          applies_to: ['**/*.ts'],
          vendor: {
            cursor: { session_id: 'abc' },  // different
            _meta: { volatile: ['cursor.session_id'] }
          }
        },
        {
          id: 'rule-2',
          severity: 'error',
          applies_to: ['**/*.js'],
          vendor: {
            aider: { context_id: '456' },  // different
            _meta: { volatile: ['aider.context_id'] }
          }
        }
      ]
    }
    
    const hash1 = computeAlignHash(pack1)
    const hash2 = computeAlignHash(pack2)
    expect(hash1).toBe(hash2)  // All volatile fields across rules excluded
  })
  
  it('handles vendor bag without volatile fields', () => {
    const pack = {
      id: 'test',
      version: '1.0.0',
      spec_version: '1',
      rules: [{
        id: 'test-rule',
        severity: 'warn',
        applies_to: ['**/*.ts'],
        vendor: {
          cursor: { ai_hint: 'test' },
          aider: { priority: 'high' }
          // No _meta.volatile
        }
      }]
    }
    
    const hash = computeAlignHash(pack)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('Stability and determinism', () => {
  it('produces identical hash across multiple runs', () => {
    const align = `
id: "base-testing"
version: "1.0.0"
spec_version: "1"
summary: "Testing baseline with deterministic tests"
rules:
  - id: "no-sleeps"
    severity: "error"
    applies_to: ["**/*.test.ts"]
    check:
      type: "regex"
      inputs:
        include: ["**/*.test.ts"]
        pattern: "sleep|setTimeout"
        allow: false
      evidence: "Sleep found in tests"
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
`
    
    const hashes = Array.from({ length: 10 }, () => computeAlignHash(align))
    const uniqueHashes = new Set(hashes)
    
    expect(uniqueHashes.size).toBe(1)
  })

  it('handles complex nested structures deterministically', () => {
    const align = `
id: "test-complex"
version: "1.0.0"
spec_version: "1"
summary: "Complex structure test"
tags: ["test", "complex", "nested"]
deps: ["base-global@^1.0.0"]
scope:
  applies_to: ["backend", "frontend"]
  includes: ["src/**/*.ts"]
  excludes: ["**/*.test.ts", "node_modules/**"]
rules:
  - id: "rule-1"
    severity: "error"
    applies_to: ["**/*.ts"]
    check:
      type: "file_presence"
      inputs:
        paths: ["**/*.test.ts"]
      evidence: "Missing test"
    autofix:
      hint: "Add test file"
  - id: "rule-2"
    severity: "warn"
    applies_to: ["src/**"]
    check:
      type: "path_convention"
      inputs:
        pattern: "^[a-z0-9-]+$"
        include: ["src/**"]
      evidence: "Bad file name"
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
`
    
    const hash1 = computeAlignHash(align)
    const hash2 = computeAlignHash(align)
    
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })
})

