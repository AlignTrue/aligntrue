/**
 * Tests for command utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseCommonArgs, showStandardHelp, executeWithLifecycle, type ArgDefinition } from '../../src/utils/command-utilities.js'

describe('parseCommonArgs', () => {
  const testDefinitions: ArgDefinition[] = [
    { flag: '--config', alias: '-c', hasValue: true, description: 'Config file path' },
    { flag: '--dry-run', hasValue: false, description: 'Dry run mode' },
    { flag: '--force', hasValue: false, description: 'Force mode' },
    { flag: '--help', alias: '-h', hasValue: false, description: 'Show help' },
  ]

  it('should parse --help flag', () => {
    const result = parseCommonArgs(['--help'], testDefinitions)
    expect(result.help).toBe(true)
  })

  it('should parse -h alias', () => {
    const result = parseCommonArgs(['-h'], testDefinitions)
    expect(result.help).toBe(true)
  })

  it('should parse boolean flags', () => {
    const result = parseCommonArgs(['--dry-run', '--force'], testDefinitions)
    expect(result.flags['dry-run']).toBe(true)
    expect(result.flags['force']).toBe(true)
  })

  it('should parse flags with values', () => {
    const result = parseCommonArgs(['--config', 'custom.yaml'], testDefinitions)
    expect(result.flags['config']).toBe('custom.yaml')
  })

  it('should parse flag aliases', () => {
    const result = parseCommonArgs(['-c', 'test.yaml'], testDefinitions)
    expect(result.flags['config']).toBe('test.yaml')
  })

  it('should extract positional arguments', () => {
    const result = parseCommonArgs(['arg1', 'arg2', '--dry-run'], testDefinitions)
    expect(result.positional).toEqual(['arg1', 'arg2'])
    expect(result.flags['dry-run']).toBe(true)
  })

  it('should handle unknown flags', () => {
    const result = parseCommonArgs(['--unknown', 'value'], testDefinitions)
    expect(result.flags['unknown']).toBe(true) // Unknown flags parsed as boolean
  })

  it('should apply default values', () => {
    const defsWithDefaults: ArgDefinition[] = [
      { flag: '--config', hasValue: true, description: 'Config', defaultValue: 'default.yaml' },
    ]
    const result = parseCommonArgs([], defsWithDefaults)
    expect(result.flags['config']).toBe('default.yaml')
  })
})

describe('showStandardHelp', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('should display usage line', () => {
    showStandardHelp({
      name: 'test',
      description: 'Test command',
      usage: 'aligntrue test [options]',
    })

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n')
    expect(output).toContain('Usage: aligntrue test [options]')
  })

  it('should display description', () => {
    showStandardHelp({
      name: 'test',
      description: 'Test command description',
      usage: 'aligntrue test',
    })

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n')
    expect(output).toContain('Test command description')
  })

  it('should display options with alignment', () => {
    const args: ArgDefinition[] = [
      { flag: '--config', alias: '-c', hasValue: true, description: 'Config file' },
      { flag: '--help', alias: '-h', hasValue: false, description: 'Show help' },
    ]

    showStandardHelp({
      name: 'test',
      description: 'Test',
      usage: 'aligntrue test',
      args,
    })

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n')
    expect(output).toContain('Options:')
    expect(output).toContain('--config, -c')
    expect(output).toContain('Config file')
  })

  it('should display examples', () => {
    showStandardHelp({
      name: 'test',
      description: 'Test',
      usage: 'aligntrue test',
      examples: ['aligntrue test', 'aligntrue test --config custom.yaml'],
    })

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n')
    expect(output).toContain('Examples:')
    expect(output).toContain('aligntrue test')
    expect(output).toContain('aligntrue test --config custom.yaml')
  })
})

describe('executeWithLifecycle', () => {
  it('should execute function successfully', async () => {
    let executed = false
    await executeWithLifecycle(
      async () => {
        executed = true
      },
      { commandName: 'test' }
    )
    expect(executed).toBe(true)
  })

  it('should catch and handle errors', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    await expect(
      executeWithLifecycle(
        async () => {
          throw new Error('Test error')
        },
        { commandName: 'test' }
      )
    ).rejects.toThrow('process.exit called')

    mockExit.mockRestore()
  })

  it('should skip telemetry if requested', async () => {
    let executed = false
    await executeWithLifecycle(
      async () => {
        executed = true
      },
      { commandName: 'test', skipTelemetry: true }
    )
    expect(executed).toBe(true)
  })

  it('should handle intro/outro if requested', async () => {
    let executed = false
    await executeWithLifecycle(
      async () => {
        executed = true
      },
      {
        commandName: 'test',
        showIntro: true,
        introMessage: 'Starting test',
        successMessage: 'Test complete',
      }
    )
    expect(executed).toBe(true)
  })

  it('should rethrow process.exit errors', async () => {
    await expect(
      executeWithLifecycle(
        async () => {
          const err = new Error('process.exit: 1')
          throw err
        },
        { commandName: 'test' }
      )
    ).rejects.toThrow('process.exit')
  })
})

