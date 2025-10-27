import { describe, it, expect } from 'vitest'
import { validateLockfile, formatValidationResult } from '../../src/lockfile/validator.js'
import { generateLockfile } from '../../src/lockfile/generator.js'
import type { AlignPack, AlignRule } from '@aligntrue/schema'
import type { Lockfile } from '../../src/lockfile/types.js'

describe('lockfile validator', () => {
  const mockRule: AlignRule = {
    id: 'test.rule.one',
    severity: 'error',
    applies_to: ['*.ts'],
    guidance: 'Test rule guidance',
  }

  const mockPack: AlignPack = {
    id: 'test.pack',
    version: '1.0.0',
    spec_version: '1',
    summary: 'Test pack',
    owner: 'test-org',
    source: 'https://github.com/test-org/aligns',
    source_sha: 'abc123',
    rules: [mockRule],
  }

  describe('validateLockfile', () => {
    it('validates matching lockfile', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      const result = validateLockfile(lockfile, mockPack)
      
      expect(result.valid).toBe(true)
      expect(result.mismatches).toHaveLength(0)
      expect(result.newRules).toHaveLength(0)
      expect(result.deletedRules).toHaveLength(0)
    })

    it('detects modified rules', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      const modifiedPack: AlignPack = {
        ...mockPack,
        rules: [{ ...mockRule, guidance: 'Modified guidance' }],
      }
      
      const result = validateLockfile(lockfile, modifiedPack)
      
      expect(result.valid).toBe(false)
      expect(result.mismatches).toHaveLength(1)
      expect(result.mismatches[0].rule_id).toBe('test.rule.one')
      expect(result.mismatches[0].expected_hash).toBeDefined()
      expect(result.mismatches[0].actual_hash).toBeDefined()
      expect(result.mismatches[0].expected_hash).not.toBe(result.mismatches[0].actual_hash)
    })

    it('detects new rules', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      const packWithNewRule: AlignPack = {
        ...mockPack,
        rules: [
          mockRule,
          { ...mockRule, id: 'test.rule.new' },
        ],
      }
      
      const result = validateLockfile(lockfile, packWithNewRule)
      
      expect(result.valid).toBe(false)
      expect(result.newRules).toHaveLength(1)
      expect(result.newRules[0]).toBe('test.rule.new')
    })

    it('detects deleted rules', () => {
      const packWithTwoRules: AlignPack = {
        ...mockPack,
        rules: [
          mockRule,
          { ...mockRule, id: 'test.rule.deleted' },
        ],
      }
      const lockfile = generateLockfile(packWithTwoRules, 'team')
      
      const result = validateLockfile(lockfile, mockPack)
      
      expect(result.valid).toBe(false)
      expect(result.deletedRules).toHaveLength(1)
      expect(result.deletedRules[0]).toBe('test.rule.deleted')
    })

    it('detects multiple types of changes', () => {
      const originalPack: AlignPack = {
        ...mockPack,
        rules: [
          { ...mockRule, id: 'test.rule.one' },
          { ...mockRule, id: 'test.rule.two' },
        ],
      }
      const lockfile = generateLockfile(originalPack, 'team')
      
      const modifiedPack: AlignPack = {
        ...mockPack,
        rules: [
          { ...mockRule, id: 'test.rule.one', guidance: 'Modified' }, // Modified
          { ...mockRule, id: 'test.rule.three' }, // New
          // test.rule.two is deleted
        ],
      }
      
      const result = validateLockfile(lockfile, modifiedPack)
      
      expect(result.valid).toBe(false)
      expect(result.mismatches).toHaveLength(1)
      expect(result.mismatches[0].rule_id).toBe('test.rule.one')
      expect(result.newRules).toHaveLength(1)
      expect(result.newRules[0]).toBe('test.rule.three')
      expect(result.deletedRules).toHaveLength(1)
      expect(result.deletedRules[0]).toBe('test.rule.two')
    })

    it('handles empty rule arrays', () => {
      const emptyPack: AlignPack = { ...mockPack, rules: [] }
      const lockfile = generateLockfile(emptyPack, 'team')
      
      const result = validateLockfile(lockfile, emptyPack)
      
      expect(result.valid).toBe(true)
      expect(result.mismatches).toHaveLength(0)
      expect(result.newRules).toHaveLength(0)
      expect(result.deletedRules).toHaveLength(0)
    })

    it('includes source in mismatch info', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      const modifiedPack: AlignPack = {
        ...mockPack,
        rules: [{ ...mockRule, guidance: 'Modified' }],
      }
      
      const result = validateLockfile(lockfile, modifiedPack)
      
      expect(result.mismatches[0].source).toBe('https://github.com/test-org/aligns')
    })
  })

  describe('formatValidationResult', () => {
    it('formats success message', () => {
      const result = {
        valid: true,
        mismatches: [],
        newRules: [],
        deletedRules: [],
      }
      
      const message = formatValidationResult(result)
      
      expect(message).toContain('up to date')
    })

    it('formats modified rules', () => {
      const result = {
        valid: false,
        mismatches: [{
          rule_id: 'test.rule.one',
          expected_hash: '1234567890abcdef',
          actual_hash: 'fedcba0987654321',
        }],
        newRules: [],
        deletedRules: [],
      }
      
      const message = formatValidationResult(result)
      
      expect(message).toContain('Modified rules')
      expect(message).toContain('test.rule.one')
      expect(message).toContain('Expected: 1234567890ab')
      expect(message).toContain('Actual:   fedcba098765')
    })

    it('formats new rules', () => {
      const result = {
        valid: false,
        mismatches: [],
        newRules: ['test.rule.new'],
        deletedRules: [],
      }
      
      const message = formatValidationResult(result)
      
      expect(message).toContain('New rules')
      expect(message).toContain('+ test.rule.new')
    })

    it('formats deleted rules', () => {
      const result = {
        valid: false,
        mismatches: [],
        newRules: [],
        deletedRules: ['test.rule.deleted'],
      }
      
      const message = formatValidationResult(result)
      
      expect(message).toContain('Deleted rules')
      expect(message).toContain('- test.rule.deleted')
    })

    it('formats multiple changes', () => {
      const result = {
        valid: false,
        mismatches: [
          {
            rule_id: 'test.rule.modified',
            expected_hash: '1234',
            actual_hash: '5678',
          },
        ],
        newRules: ['test.rule.new'],
        deletedRules: ['test.rule.deleted'],
      }
      
      const message = formatValidationResult(result)
      
      expect(message).toContain('Modified rules')
      expect(message).toContain('New rules')
      expect(message).toContain('Deleted rules')
    })
  })
})

