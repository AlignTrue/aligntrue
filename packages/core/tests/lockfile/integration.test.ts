import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readLockfile, writeLockfile, generateLockfile, validateLockfile, enforceLockfile } from '../../src/lockfile/index.js'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import type { AlignPack } from '@aligntrue/schema'

describe('lockfile integration', () => {
  const testDir = join(process.cwd(), 'packages/core/tests/lockfile/temp-integration')
  const lockfilePath = join(testDir, '.aligntrue.lock.json')

  const mockPack: AlignPack = {
    id: 'test.pack',
    version: '1.0.0',
    spec_version: '1',
    summary: 'Test pack',
    owner: 'test-org',
    source: 'https://github.com/test-org/aligns',
    source_sha: 'abc123',
    rules: [
      {
        id: 'test.rule.one',
        severity: 'error',
        applies_to: ['*.ts'],
        guidance: 'Test rule one',
      },
    ],
  }

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('end-to-end workflow', () => {
    it('generates lockfile for a pack', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      writeLockfile(lockfilePath, lockfile)
      
      expect(existsSync(lockfilePath)).toBe(true)
      
      const read = readLockfile(lockfilePath)
      expect(read).not.toBeNull()
      expect(read?.rules).toHaveLength(1)
      expect(read?.mode).toBe('team')
    })

    it('validates matching lockfile', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      writeLockfile(lockfilePath, lockfile)
      
      const validation = validateLockfile(lockfile, mockPack)
      const enforcement = enforceLockfile('soft', validation)
      
      expect(validation.valid).toBe(true)
      expect(enforcement.success).toBe(true)
      expect(enforcement.exitCode).toBe(0)
    })

    it('detects drift and enforces based on mode', () => {
      // Generate lockfile with original pack
      const lockfile = generateLockfile(mockPack, 'team')
      writeLockfile(lockfilePath, lockfile)
      
      // Modify pack
      const modifiedPack: AlignPack = {
        ...mockPack,
        rules: [{ ...mockPack.rules[0], guidance: 'Modified guidance' }],
      }
      
      // Validate should detect mismatch
      const validation = validateLockfile(lockfile, modifiedPack)
      expect(validation.valid).toBe(false)
      expect(validation.mismatches).toHaveLength(1)
      
      // Soft mode allows continuation
      const softEnforcement = enforceLockfile('soft', validation)
      expect(softEnforcement.success).toBe(true)
      expect(softEnforcement.exitCode).toBe(0)
      
      // Strict mode blocks
      const strictEnforcement = enforceLockfile('strict', validation)
      expect(strictEnforcement.success).toBe(false)
      expect(strictEnforcement.exitCode).toBe(1)
    })

    it('handles new rules', () => {
      const lockfile = generateLockfile(mockPack, 'team')
      writeLockfile(lockfilePath, lockfile)
      
      const packWithNewRule: AlignPack = {
        ...mockPack,
        rules: [
          ...mockPack.rules,
          { ...mockPack.rules[0], id: 'test.rule.new' },
        ],
      }
      
      const validation = validateLockfile(lockfile, packWithNewRule)
      expect(validation.valid).toBe(false)
      expect(validation.newRules).toHaveLength(1)
      expect(validation.newRules[0]).toBe('test.rule.new')
    })

    it('handles deleted rules', () => {
      const packWithTwoRules: AlignPack = {
        ...mockPack,
        rules: [
          mockPack.rules[0],
          { ...mockPack.rules[0], id: 'test.rule.deleted' },
        ],
      }
      const lockfile = generateLockfile(packWithTwoRules, 'team')
      writeLockfile(lockfilePath, lockfile)
      
      const validation = validateLockfile(lockfile, mockPack)
      expect(validation.valid).toBe(false)
      expect(validation.deletedRules).toHaveLength(1)
      expect(validation.deletedRules[0]).toBe('test.rule.deleted')
    })

    it('regenerates lockfile after changes', () => {
      // Initial lockfile
      const lockfile1 = generateLockfile(mockPack, 'team')
      writeLockfile(lockfilePath, lockfile1)
      
      // Modify pack and regenerate
      const modifiedPack: AlignPack = {
        ...mockPack,
        rules: [{ ...mockPack.rules[0], guidance: 'Modified guidance' }],
      }
      const lockfile2 = generateLockfile(modifiedPack, 'team')
      writeLockfile(lockfilePath, lockfile2)
      
      // New lockfile should validate against modified pack
      const validation = validateLockfile(lockfile2, modifiedPack)
      expect(validation.valid).toBe(true)
      
      // But not against original pack
      const validation2 = validateLockfile(lockfile2, mockPack)
      expect(validation2.valid).toBe(false)
    })
  })

  describe('vendor.volatile exclusion', () => {
    it('excludes volatile fields from hash', () => {
      const packWithVolatile: AlignPack = {
        ...mockPack,
        rules: [
          {
            ...mockPack.rules[0],
            vendor: {
              cursor: { stable: 'value', session_id: 'abc123' },
              _meta: { volatile: ['cursor.session_id'] },
            },
          },
        ],
      }
      
      const packWithDifferentVolatile: AlignPack = {
        ...mockPack,
        rules: [
          {
            ...mockPack.rules[0],
            vendor: {
              cursor: { stable: 'value', session_id: 'def456' },
              _meta: { volatile: ['cursor.session_id'] },
            },
          },
        ],
      }
      
      const lockfile1 = generateLockfile(packWithVolatile, 'team')
      const lockfile2 = generateLockfile(packWithDifferentVolatile, 'team')
      
      // Hashes should be identical (volatile field excluded)
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash)
      expect(lockfile1.rules[0].content_hash).toBe(lockfile2.rules[0].content_hash)
    })
  })
})

