/**
 * Tests for conflict detection
 */

import { describe, it, expect } from 'vitest'
import { ConflictDetector } from '../../src/sync/conflict-detector.js'
import type { AlignRule } from '@aligntrue/schema'

describe('ConflictDetector', () => {
  const detector = new ConflictDetector()

  describe('Field-level conflicts', () => {
    it('detects severity conflicts', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test rule',
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'error',
          guidance: 'Test rule',
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].field).toBe('severity')
      expect(result.conflicts[0].irValue).toBe('warn')
      expect(result.conflicts[0].agentValue).toBe('error')
    })

    it('detects guidance conflicts', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Original guidance',
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Modified guidance',
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].field).toBe('guidance')
    })

    it('detects applies_to conflicts', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          applies_to: ['src/**/*.ts'],
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          applies_to: ['src/**/*.js'],
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].field).toBe('applies_to')
    })

    it('detects tags conflicts', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          tags: ['testing', 'quality'],
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          tags: ['testing'],
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].field).toBe('tags')
    })
  })

  describe('No conflicts', () => {
    it('returns no conflicts when rules match', () => {
      const rules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test rule',
        },
      ]

      const result = detector.detectConflicts('cursor', rules, rules)

      expect(result.hasConflicts).toBe(false)
      expect(result.conflicts).toHaveLength(0)
    })

    it('ignores new rules in IR (not conflicts)', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule1',
          severity: 'warn',
          guidance: 'Rule 1',
        },
        {
          id: 'test.rule2',
          severity: 'warn',
          guidance: 'Rule 2',
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule1',
          severity: 'warn',
          guidance: 'Rule 1',
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(false)
    })
  })

  describe('Deleted rules', () => {
    it('detects rules deleted from IR', () => {
      const irRules: AlignRule[] = []

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test rule',
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].field).toBe('(entire rule)')
      expect(result.conflicts[0].irValue).toBeUndefined()
    })
  })

  describe('Vendor bag conflicts', () => {
    it('detects vendor bag field conflicts', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              ai_hint: 'Original hint',
            },
          },
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              ai_hint: 'Modified hint',
            },
          },
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].field).toBe('vendor.cursor.ai_hint')
    })

    it('ignores volatile vendor fields', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              ai_hint: 'Hint',
              session_id: 'session1',
            },
            _meta: {
              volatile: ['cursor.session_id'],
            },
          },
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              ai_hint: 'Hint',
              session_id: 'session2', // Different but volatile
            },
          },
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(false)
    })

    it('ignores entire vendor bag if marked volatile', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              temp_field: 'value1',
            },
            _meta: {
              volatile: ['vendor.cursor'],
            },
          },
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              temp_field: 'value2',
            },
          },
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(false)
    })

    it('supports wildcard volatile patterns', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              temp_data: 'value1',
            },
            _meta: {
              volatile: ['*.temp_data'],
            },
          },
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          vendor: {
            cursor: {
              temp_data: 'value2',
            },
          },
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(false)
    })
  })

  describe('Missing fields', () => {
    it('detects undefined vs null differences', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          tags: undefined,
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
          tags: [],
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts[0].field).toBe('tags')
    })
  })

  describe('Structured diffs', () => {
    it('generates readable diff strings', () => {
      const irRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'warn',
          guidance: 'Test',
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'test.rule',
          severity: 'error',
          guidance: 'Test',
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      expect(result.conflicts[0].diff).toContain('Field: severity')
      expect(result.conflicts[0].diff).toContain('IR value')
      expect(result.conflicts[0].diff).toContain('Agent value')
      expect(result.conflicts[0].diff).toContain('warn')
      expect(result.conflicts[0].diff).toContain('error')
    })
  })
})

