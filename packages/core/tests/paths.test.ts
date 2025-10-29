/**
 * Tests for path utilities
 */

import { describe, it, expect } from 'vitest'
import { join, sep } from 'path'
import { getAlignTruePaths, getAlignTrueDir, getCacheDir } from '../src/paths.js'

describe('getAlignTruePaths', () => {
  const testCwd = '/test/workspace'
  
  it('should generate standard config path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.config).toBe(join(testCwd, '.aligntrue', 'config.yaml'))
  })
  
  it('should generate rules path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.rules).toBe(join(testCwd, '.aligntrue', 'rules.md'))
  })
  
  it('should generate lockfile path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.lockfile).toBe(join(testCwd, '.aligntrue.lock.json'))
  })
  
  it('should generate bundle path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.bundle).toBe(join(testCwd, '.aligntrue.bundle.yaml'))
  })
  
  it('should generate Cursor rules path for default scope', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.cursorRules('default')).toBe(join(testCwd, '.cursor', 'rules', 'aligntrue.mdc'))
  })
  
  it('should generate Cursor rules path for custom scope', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.cursorRules('backend')).toBe(join(testCwd, '.cursor', 'rules', 'backend.mdc'))
  })
  
  it('should normalize slashes in scope names', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.cursorRules('backend/api')).toBe(join(testCwd, '.cursor', 'rules', 'backend-api.mdc'))
  })
  
  it('should generate AGENTS.md path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.agentsMd()).toBe(join(testCwd, 'AGENTS.md'))
  })
  
  it('should generate VS Code MCP path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.vscodeMcp()).toBe(join(testCwd, '.vscode', 'mcp.json'))
  })
  
  it('should generate cache path for catalog', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.cache('catalog')).toBe(join(testCwd, '.aligntrue', '.cache', 'catalog'))
  })
  
  it('should generate cache path for git', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.cache('git')).toBe(join(testCwd, '.aligntrue', '.cache', 'git'))
  })
  
  it('should generate privacy consent path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.privacyConsent()).toBe(join(testCwd, '.aligntrue', 'privacy-consent.json'))
  })
  
  it('should generate telemetry events path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.telemetryEvents()).toBe(join(testCwd, '.aligntrue', 'telemetry-events.json'))
  })
  
  it('should generate aligntrue directory path', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.aligntrueDir).toBe(join(testCwd, '.aligntrue'))
  })
  
  it('should generate exporter output paths for cursor', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.exporterOutput('cursor', 'test.mdc')).toBe(join(testCwd, '.cursor', 'rules', 'test.mdc'))
  })
  
  it('should generate exporter output paths for vscode-mcp', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.exporterOutput('vscode-mcp', 'mcp.json')).toBe(join(testCwd, '.vscode', 'mcp.json'))
  })
  
  it('should generate exporter output paths for amazonq', () => {
    const paths = getAlignTruePaths(testCwd)
    expect(paths.exporterOutput('amazonq', 'rule.md')).toBe(join(testCwd, '.amazonq', 'rules', 'rule.md'))
  })
  
  it('should use current working directory by default', () => {
    const paths = getAlignTruePaths()
    expect(paths.config).toBe(join(process.cwd(), '.aligntrue', 'config.yaml'))
  })
  
  it('should use platform-specific path separators', () => {
    const paths = getAlignTruePaths(testCwd)
    // Test that path contains platform separator
    expect(paths.config).toContain(sep)
  })
})

describe('getAlignTrueDir', () => {
  it('should return .aligntrue directory path', () => {
    const dir = getAlignTrueDir('/test/workspace')
    expect(dir).toBe(join('/test/workspace', '.aligntrue'))
  })
  
  it('should use current working directory by default', () => {
    const dir = getAlignTrueDir()
    expect(dir).toBe(join(process.cwd(), '.aligntrue'))
  })
})

describe('getCacheDir', () => {
  it('should return cache directory for catalog', () => {
    const dir = getCacheDir('catalog', '/test/workspace')
    expect(dir).toBe(join('/test/workspace', '.aligntrue', '.cache', 'catalog'))
  })
  
  it('should return cache directory for git', () => {
    const dir = getCacheDir('git', '/test/workspace')
    expect(dir).toBe(join('/test/workspace', '.aligntrue', '.cache', 'git'))
  })
  
  it('should use current working directory by default', () => {
    const dir = getCacheDir('test')
    expect(dir).toBe(join(process.cwd(), '.aligntrue', '.cache', 'test'))
  })
})

