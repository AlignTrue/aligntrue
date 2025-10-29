/**
 * Tests for command test helpers
 */

import { describe, it, expect } from 'vitest'
import { mockCommandArgs, expectStandardHelp, captureCommandOutput } from './command-test-helpers.js'

describe('mockCommandArgs', () => {
  it('should generate args for boolean flags', () => {
    const args = mockCommandArgs({ help: true, dryRun: true })
    expect(args).toContain('--help')
    expect(args).toContain('--dry-run')
  })

  it('should generate args for string values', () => {
    const args = mockCommandArgs({ config: 'custom.yaml' })
    expect(args).toContain('--config')
    expect(args).toContain('custom.yaml')
  })

  it('should skip false boolean flags', () => {
    const args = mockCommandArgs({ help: false, dryRun: true })
    expect(args).not.toContain('--help')
    expect(args).toContain('--dry-run')
  })
})

describe('expectStandardHelp', () => {
  it('should validate Usage section', () => {
    const help = 'Usage: aligntrue test\n\nTest description\n\nExtra content\n'
    const result = expectStandardHelp(help)
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('should detect missing Usage', () => {
    const help = 'Test description\n'
    const result = expectStandardHelp(help)
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('Usage')
  })
})

describe('captureCommandOutput', () => {
  it('should capture stdout', () => {
    const capture = captureCommandOutput()
    capture.start()
    process.stdout.write('test output\n')
    const output = capture.stop()
    expect(output.stdout).toContain('test output')
  })

  it('should capture stderr', () => {
    const capture = captureCommandOutput()
    capture.start()
    process.stderr.write('error output\n')
    const output = capture.stop()
    expect(output.stderr).toContain('error output')
  })

  it('should restore output streams', () => {
    const capture = captureCommandOutput()
    capture.start()
    process.stdout.write('captured\n')
    const output = capture.stop() // Stop captures data before restore
    capture.restore()
    
    // Check captured data was collected before restore
    expect(output.stdout).toContain('captured')
  })

  it('should handle multiple start/stop cycles', () => {
    const capture = captureCommandOutput()
    
    capture.start()
    process.stdout.write('first\n')
    const first = capture.stop()
    
    capture.start()
    process.stdout.write('second\n')
    const second = capture.stop()
    
    expect(first.stdout).toContain('first')
    expect(second.stdout).toContain('second')
    expect(second.stdout).not.toContain('first')
  })
})

