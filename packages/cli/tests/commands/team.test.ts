/**
 * Tests for team command
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { team } from '../../src/commands/team.js'
import * as fs from 'fs'
import * as clack from '@clack/prompts'

// Mock filesystem
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
  renameSync: vi.fn(),
}))

// Mock telemetry collector
vi.mock('@aligntrue/core/telemetry/collector.js', () => ({
  recordEvent: vi.fn(),
}))

// Mock @aligntrue/core
vi.mock('@aligntrue/core', () => ({
  loadConfig: vi.fn(),
}))

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  outro: vi.fn(),
  isCancel: vi.fn(),
  log: {
    info: vi.fn(),
  },
}))

describe('team command', () => {
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
      await expect(team(['--help'])).rejects.toThrow('process.exit(0)')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Usage: aligntrue team'))
    })

    it('shows help with no args', async () => {
      await expect(team([])).rejects.toThrow('process.exit(0)')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Team mode features:'))
    })
  })

  describe('enable', () => {
    it('enables team mode successfully', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        modules: { lockfile: false, bundle: false },
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })
      vi.mocked(clack.confirm).mockResolvedValue(true)
      vi.mocked(clack.isCancel).mockReturnValue(false)

      await expect(team(['enable'])).rejects.toThrow('process.exit')
      
      expect(clack.intro).toHaveBeenCalledWith('Team Mode Enable')
      expect(clack.confirm).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      expect(clack.outro).toHaveBeenCalledWith('✓ Team mode enabled')
    })

    it('fails when config not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      await expect(team(['enable'])).rejects.toThrow('process.exit(1)')
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Config file not found'))
    })

    it('handles already in team mode', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'team',
        modules: { lockfile: true, bundle: true },
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })

      await expect(team(['enable'])).rejects.toThrow('process.exit(0)')
      
      expect(console.log).toHaveBeenCalledWith('✓ Already in team mode')
    })

    it('cancels when user declines', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        modules: { lockfile: false, bundle: false },
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })
      vi.mocked(clack.confirm).mockResolvedValue(false)
      vi.mocked(clack.isCancel).mockReturnValue(false)

      await expect(team(['enable'])).rejects.toThrow('process.exit(0)')
      
      expect(clack.cancel).toHaveBeenCalledWith('Team mode enable cancelled')
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('cancels when user presses Ctrl+C', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        modules: { lockfile: false, bundle: false },
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })
      vi.mocked(clack.confirm).mockResolvedValue(Symbol('cancel') as any)
      vi.mocked(clack.isCancel).mockReturnValue(true)

      await expect(team(['enable'])).rejects.toThrow('process.exit(0)')
      
      expect(clack.cancel).toHaveBeenCalled()
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('writes config atomically', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        modules: { lockfile: false, bundle: false },
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })
      vi.mocked(clack.confirm).mockResolvedValue(true)
      vi.mocked(clack.isCancel).mockReturnValue(false)

      await expect(team(['enable'])).rejects.toThrow('process.exit')
      
      // Should create directory
      expect(fs.mkdirSync).toHaveBeenCalled()
      
      // Should write to temp file
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls
      expect(writeCalls[0]?.[0]).toBe('.aligntrue/config.yaml.tmp')
      expect(writeCalls[0]?.[1]).toContain('mode: team')
      
      // Should rename atomically (temp → final)
      expect(fs.renameSync).toHaveBeenCalledWith(
        '.aligntrue/config.yaml.tmp',
        '.aligntrue/config.yaml'
      )
    })

    it('handles load config error', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockRejectedValue(new Error('Invalid YAML'))

      await expect(team(['enable'])).rejects.toThrow('process.exit(1)')
      
      expect(console.error).toHaveBeenCalledWith('✗ Failed to enable team mode')
    })

    it('handles write error', async () => {
      const { loadConfig } = await import('@aligntrue/core')
      
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(loadConfig).mockResolvedValue({
        version: '1',
        mode: 'solo',
        modules: { lockfile: false, bundle: false },
        exporters: ['cursor'],
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
      })
      vi.mocked(clack.confirm).mockResolvedValue(true)
      vi.mocked(clack.isCancel).mockReturnValue(false)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await expect(team(['enable'])).rejects.toThrow('process.exit(1)')
      
      expect(console.error).toHaveBeenCalledWith('✗ Failed to enable team mode')
    })
  })

  describe('invalid subcommand', () => {
    it('shows error for unknown subcommand', async () => {
      await expect(team(['unknown'])).rejects.toThrow('process.exit(1)')
      expect(console.error).toHaveBeenCalledWith('Unknown subcommand: unknown')
    })
  })
})

