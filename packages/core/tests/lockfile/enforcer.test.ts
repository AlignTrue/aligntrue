import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enforceLockfile } from '../../src/lockfile/enforcer.js'
import type { ValidationResult } from '../../src/lockfile/types.js'

describe('lockfile enforcer', () => {
  // Mock console methods
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  const validResult: ValidationResult = {
    valid: true,
    mismatches: [],
    newRules: [],
    deletedRules: [],
  }

  const invalidResult: ValidationResult = {
    valid: false,
    mismatches: [
      {
        rule_id: 'test.rule.one',
        expected_hash: 'abc123',
        actual_hash: 'def456',
      },
    ],
    newRules: ['test.rule.new'],
    deletedRules: ['test.rule.deleted'],
  }

  describe('off mode', () => {
    it('always succeeds without validation', () => {
      const result = enforceLockfile('off', invalidResult)
      
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('does not log anything', () => {
      enforceLockfile('off', validResult)
      
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('soft mode', () => {
    it('succeeds when validation passes', () => {
      const result = enforceLockfile('soft', validResult)
      
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.message).toContain('passed')
    })

    it('warns but succeeds when validation fails', () => {
      const result = enforceLockfile('soft', invalidResult)
      
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.message).toBeDefined()
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('logs warnings to stderr', () => {
      enforceLockfile('soft', invalidResult)
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lockfile drift detected')
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Modified rules')
      )
    })

    it('suggests running aligntrue lock', () => {
      enforceLockfile('soft', invalidResult)
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('aligntrue lock')
      )
    })

    it('does not call console.error', () => {
      enforceLockfile('soft', invalidResult)
      
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('strict mode', () => {
    it('succeeds when validation passes', () => {
      const result = enforceLockfile('strict', validResult)
      
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.message).toContain('passed')
    })

    it('fails when validation fails', () => {
      const result = enforceLockfile('strict', invalidResult)
      
      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
      expect(result.message).toBeDefined()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('logs errors to stderr', () => {
      enforceLockfile('strict', invalidResult)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lockfile validation failed')
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Modified rules')
      )
    })

    it('aborts sync on failure', () => {
      enforceLockfile('strict', invalidResult)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sync aborted')
      )
    })

    it('suggests running aligntrue lock', () => {
      enforceLockfile('strict', invalidResult)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('aligntrue lock')
      )
    })

    it('does not call console.warn', () => {
      enforceLockfile('strict', invalidResult)
      
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('exit codes', () => {
    it('returns 0 for off mode', () => {
      const result = enforceLockfile('off', invalidResult)
      expect(result.exitCode).toBe(0)
    })

    it('returns 0 for soft mode', () => {
      const result = enforceLockfile('soft', invalidResult)
      expect(result.exitCode).toBe(0)
    })

    it('returns 0 for strict mode when valid', () => {
      const result = enforceLockfile('strict', validResult)
      expect(result.exitCode).toBe(0)
    })

    it('returns 1 for strict mode when invalid', () => {
      const result = enforceLockfile('strict', invalidResult)
      expect(result.exitCode).toBe(1)
    })
  })

  describe('message content', () => {
    it('includes validation details in message', () => {
      const result = enforceLockfile('soft', invalidResult)
      
      expect(result.message).toContain('test.rule.one')
      expect(result.message).toContain('test.rule.new')
      expect(result.message).toContain('test.rule.deleted')
    })
  })
})

