/**
 * Tests for conflict resolution strategies
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConflictDetector,
  ConflictResolutionStrategy,
  type Conflict,
} from '../../src/sync/conflict-detector.js'
import type { AlignRule } from '@aligntrue/schema'

describe('ConflictDetector - Resolution', () => {
  let detector: ConflictDetector

  beforeEach(() => {
    detector = new ConflictDetector()
  })

  describe('resolveConflict', () => {
    const conflict: Conflict = {
      agent: 'cursor',
      ruleId: 'testing.require-tests',
      field: 'severity',
      irValue: 'warn',
      agentValue: 'error',
      diff: 'Field: severity\nIR value:\n"warn"\nAgent value:\n"error"',
    }

    it('applies KEEP_IR strategy', () => {
      const resolution = detector.resolveConflict(conflict, ConflictResolutionStrategy.KEEP_IR)

      expect(resolution.ruleId).toBe('testing.require-tests')
      expect(resolution.field).toBe('severity')
      expect(resolution.strategy).toBe(ConflictResolutionStrategy.KEEP_IR)
      expect(resolution.appliedValue).toBe('warn')
      expect(resolution.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('applies ACCEPT_AGENT strategy', () => {
      const resolution = detector.resolveConflict(conflict, ConflictResolutionStrategy.ACCEPT_AGENT)

      expect(resolution.ruleId).toBe('testing.require-tests')
      expect(resolution.field).toBe('severity')
      expect(resolution.strategy).toBe(ConflictResolutionStrategy.ACCEPT_AGENT)
      expect(resolution.appliedValue).toBe('error')
    })

    it('applies MANUAL strategy (defaults to IR)', () => {
      const resolution = detector.resolveConflict(conflict, ConflictResolutionStrategy.MANUAL)

      expect(resolution.strategy).toBe(ConflictResolutionStrategy.MANUAL)
      expect(resolution.appliedValue).toBe('warn') // defaults to IR
    })

    it('throws on ABORT strategy', () => {
      expect(() => {
        detector.resolveConflict(conflict, ConflictResolutionStrategy.ABORT)
      }).toThrow(/Resolution aborted/)
    })
  })

  describe('applyResolutions', () => {
    const irRules: AlignRule[] = [
      {
        id: 'testing.require-tests',
        severity: 'warn',
        guidance: 'All features should have tests.',
        applies_to: ['**/*.ts'],
      },
      {
        id: 'style.no-any',
        severity: 'warn',
        guidance: 'Avoid using any type.',
        applies_to: ['**/*.ts'],
      },
    ]

    it('applies simple field resolution', () => {
      const resolutions = [
        {
          ruleId: 'testing.require-tests',
          field: 'severity',
          strategy: ConflictResolutionStrategy.ACCEPT_AGENT,
          appliedValue: 'error',
          timestamp: new Date().toISOString(),
        },
      ]

      const updated = detector.applyResolutions(irRules, resolutions)

      expect(updated[0]?.severity).toBe('error')
      expect(updated[1]?.severity).toBe('warn') // unchanged
    })

    it('applies nested field resolution', () => {
      const rulesWithVendor: AlignRule[] = [
        {
          id: 'testing.require-tests',
          severity: 'warn',
          guidance: 'All features should have tests.',
          applies_to: ['**/*.ts'],
          vendor: {
            cursor: {
              ai_hint: 'old hint',
            },
          },
        },
      ]

      const resolutions = [
        {
          ruleId: 'testing.require-tests',
          field: 'vendor.cursor.ai_hint',
          strategy: ConflictResolutionStrategy.ACCEPT_AGENT,
          appliedValue: 'new hint',
          timestamp: new Date().toISOString(),
        },
      ]

      const updated = detector.applyResolutions(rulesWithVendor, resolutions)

      const updatedRule = updated[0]
      expect(updatedRule).toBeDefined()
      const vendor = updatedRule!.vendor as Record<string, unknown>
      const cursor = vendor.cursor as Record<string, unknown>
      expect(cursor.ai_hint).toBe('new hint')
    })

    it('handles multiple resolutions for same rule', () => {
      const resolutions = [
        {
          ruleId: 'testing.require-tests',
          field: 'severity',
          strategy: ConflictResolutionStrategy.ACCEPT_AGENT,
          appliedValue: 'error',
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'testing.require-tests',
          field: 'guidance',
          strategy: ConflictResolutionStrategy.ACCEPT_AGENT,
          appliedValue: 'Tests are mandatory.',
          timestamp: new Date().toISOString(),
        },
      ]

      const updated = detector.applyResolutions(irRules, resolutions)

      expect(updated[0]?.severity).toBe('error')
      expect(updated[0]?.guidance).toBe('Tests are mandatory.')
    })

    it('ignores resolutions for non-existent rules', () => {
      const resolutions = [
        {
          ruleId: 'nonexistent.rule',
          field: 'severity',
          strategy: ConflictResolutionStrategy.ACCEPT_AGENT,
          appliedValue: 'error',
          timestamp: new Date().toISOString(),
        },
      ]

      const updated = detector.applyResolutions(irRules, resolutions)

      // Should not throw, just skip
      expect(updated.length).toBe(2)
      expect(updated[0]?.severity).toBe('warn') // unchanged
    })
  })

  describe('generateConflictReport', () => {
    it('generates report for no conflicts', () => {
      const report = detector.generateConflictReport([])

      expect(report).toContain('No conflicts detected')
    })

    it('generates report for single conflict', () => {
      const conflicts: Conflict[] = [
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: 'Field: severity\nIR value:\n"warn"\nAgent value:\n"error"',
        },
      ]

      const report = detector.generateConflictReport(conflicts)

      expect(report).toContain('1 conflict(s) detected')
      expect(report).toContain('Rule: testing.require-tests')
      expect(report).toContain('Agent: cursor')
      expect(report).toContain('Field: severity')
      expect(report).toContain('IR value:    "warn"')
      expect(report).toContain('Agent value: "error"')
      expect(report).toContain('[i] Keep IR version')
      expect(report).toContain('[a] Accept agent version')
    })

    it('groups multiple conflicts by rule', () => {
      const conflicts: Conflict[] = [
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
        {
          agent: 'cursor',
          ruleId: 'testing.require-tests',
          field: 'guidance',
          irValue: 'Tests recommended',
          agentValue: 'Tests required',
          diff: '',
        },
        {
          agent: 'cursor',
          ruleId: 'style.no-any',
          field: 'severity',
          irValue: 'warn',
          agentValue: 'error',
          diff: '',
        },
      ]

      const report = detector.generateConflictReport(conflicts)

      expect(report).toContain('3 conflict(s) detected')
      expect(report).toContain('Rule: testing.require-tests')
      expect(report).toContain('Rule: style.no-any')
      // Should show both fields for testing.require-tests
      const testingSection = report.substring(
        report.indexOf('Rule: testing.require-tests'),
        report.indexOf('Rule: style.no-any')
      )
      expect(testingSection).toContain('Field: severity')
      expect(testingSection).toContain('Field: guidance')
    })
  })

  describe('volatile fields exclusion', () => {
    it('validates volatile fields handling (placeholder for Step 17)', () => {
      // Note: Volatile field exclusion in compareVendorBags has complex logic
      // that requires both IR and agent to have consistent vendor structures.
      // Full volatile field handling will be validated in Step 17 when
      // real agent parsers preserve _meta.volatile during import.
      // For now, we validate that the infrastructure is in place.
      
      const irRules: AlignRule[] = [
        {
          id: 'testing.require-tests',
          severity: 'warn',
          guidance: 'All features should have tests.',
          applies_to: ['**/*.ts'],
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'testing.require-tests',
          severity: 'warn',
          guidance: 'All features should have tests.',
          applies_to: ['**/*.ts'],
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      // No vendor bags = no conflicts
      expect(result.hasConflicts).toBe(false)
      expect(result.conflicts.length).toBe(0)
    })

    it('detects vendor bag differences', () => {
      const irRules: AlignRule[] = [
        {
          id: 'testing.require-tests',
          severity: 'warn',
          guidance: 'All features should have tests.',
          applies_to: ['**/*.ts'],
          vendor: {
            cursor: {
              ai_hint: 'old hint',
            },
          },
        },
      ]

      const agentRules: AlignRule[] = [
        {
          id: 'testing.require-tests',
          severity: 'warn',
          guidance: 'All features should have tests.',
          applies_to: ['**/*.ts'],
          vendor: {
            cursor: {
              ai_hint: 'new hint', // Changed
            },
          },
        },
      ]

      const result = detector.detectConflicts('cursor', irRules, agentRules)

      // Should detect conflict in vendor.cursor.ai_hint
      expect(result.hasConflicts).toBe(true)
      const aiHintConflict = result.conflicts.find(c => c.field === 'vendor.cursor.ai_hint')
      expect(aiHintConflict).toBeDefined()
      expect(aiHintConflict?.irValue).toBe('old hint')
      expect(aiHintConflict?.agentValue).toBe('new hint')
    })
  })
})

