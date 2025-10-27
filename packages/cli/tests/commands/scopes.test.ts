/**
 * Tests for scopes command
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { scopes } from '../../src/commands/scopes.js'
import * as fs from 'fs'

// Mock filesystem
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

// Mock @aligntrue/core
vi.mock('@aligntrue/core', () => ({
  loadConfig: vi.fn(),
}))

describe('scopes command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`)
    })
  })

  describe('help', () => {
    it('shows help with --help flag', async () => {
      await expect(scopes(['--help'])).rejects.toThrow('process.exit(0)')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage: aligntrue scopes'))
    })
  })

  describe('list scopes', () => {
    it('lists configured scopes successfully', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [
          {
            path: 'packages/frontend',
            include: ['*.ts', '*.tsx'],
            exclude: ['**/*.test.ts'],
          },
          {
            path: 'packages/backend',
            include: ['*.ts'],
            exclude: ['**/*.spec.ts'],
          },
        ],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit')
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scopes configured'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('packages/frontend'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('packages/backend'))
    })

    it('shows include patterns', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [
          {
            path: 'packages/frontend',
            include: ['*.ts', '*.tsx'],
          },
        ],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit')
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Include: *.ts, *.tsx'))
    })

    it('shows exclude patterns', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [
          {
            path: 'packages/frontend',
            exclude: ['**/*.test.ts', '**/*.spec.ts'],
          },
        ],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit')
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Exclude: **/*.test.ts, **/*.spec.ts'))
    })

    it('shows rulesets when present', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [
          {
            path: 'packages/frontend',
            rulesets: ['base-global', 'base-typescript'],
          },
        ],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit')
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Rulesets: base-global, base-typescript'))
    })

    it('shows total count', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [
          { path: 'packages/frontend' },
          { path: 'packages/backend' },
        ],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit')
      
      expect(console.log).toHaveBeenCalledWith('Total: 2 scopes')
    })

    it('handles singular scope count', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [
          { path: 'packages/frontend' },
        ],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit')
      
      expect(console.log).toHaveBeenCalledWith('Total: 1 scope')
    })

    it('handles no scopes configured', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit(0)')
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No scopes configured'))
    })

    it('handles empty scopes array', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        scopes: [],
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(scopes([])).rejects.toThrow('process.exit(0)')
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No scopes configured'))
    })

    it('fails when config not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      await expect(scopes([])).rejects.toThrow('process.exit(1)')
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Config file not found'))
    })

    it('handles load config error', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockRejectedValue(new Error('Invalid YAML'))

      await expect(scopes([])).rejects.toThrow('process.exit(1)')
      
      expect(console.error).toHaveBeenCalledWith('✗ Failed to load scopes')
    })
  })
})

