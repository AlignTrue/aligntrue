/**
 * Tests for agent→IR import functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { importFromAgent, canImportFromAgent, getImportSourcePath } from '../../src/sync/import.js'

describe('canImportFromAgent', () => {
  it('should return true for supported agents', () => {
    expect(canImportFromAgent('cursor')).toBe(true)
    expect(canImportFromAgent('copilot')).toBe(true)
    expect(canImportFromAgent('claude-code')).toBe(true)
    expect(canImportFromAgent('aider')).toBe(true)
    expect(canImportFromAgent('agents-md')).toBe(true)
  })

  it('should return false for unsupported agents', () => {
    expect(canImportFromAgent('unknown')).toBe(false)
    expect(canImportFromAgent('vscode')).toBe(false)
  })

  it('should be case insensitive', () => {
    expect(canImportFromAgent('CURSOR')).toBe(true)
    expect(canImportFromAgent('Cursor')).toBe(true)
  })
})

describe('getImportSourcePath', () => {
  it('should return cursor path for cursor', () => {
    const path = getImportSourcePath('cursor', '/test/workspace')
    expect(path).toBe('/test/workspace/.cursor/rules')
  })

  it('should return AGENTS.md path for universal agents', () => {
    expect(getImportSourcePath('copilot', '/test/workspace')).toBe('/test/workspace/AGENTS.md')
    expect(getImportSourcePath('claude-code', '/test/workspace')).toBe('/test/workspace/AGENTS.md')
    expect(getImportSourcePath('aider', '/test/workspace')).toBe('/test/workspace/AGENTS.md')
  })

  it('should return empty string for unsupported agents', () => {
    expect(getImportSourcePath('unknown', '/test/workspace')).toBe('')
  })
})

describe('importFromAgent', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'aligntrue-import-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('cursor import', () => {
    it('should import rules from .cursor/*.mdc files', async () => {
      // Create .cursor/rules directory
      const cursorDir = join(tmpDir, '.cursor', 'rules')
      await mkdir(cursorDir, { recursive: true })

      // Create a sample .mdc file
      const mdcContent = `---
description: Test rules
alwaysApply: true
---
## Rule: test-rule

**Severity:** error

**Applies to:**
- \`**/*.ts\`

This is test guidance.
`
      await writeFile(join(cursorDir, 'test.mdc'), mdcContent, 'utf-8')

      // Import rules
      const rules = await importFromAgent('cursor', tmpDir)

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatchObject({
        id: 'test-rule',
        severity: 'error',
        applies_to: ['**/*.ts'],
        guidance: 'This is test guidance.',
      })
    })

    it('should merge rules from multiple .mdc files', async () => {
      const cursorDir = join(tmpDir, '.cursor', 'rules')
      await mkdir(cursorDir, { recursive: true })

      await writeFile(join(cursorDir, 'file1.mdc'), `---
---
## Rule: rule-one

**Severity:** error

Guidance one.
`, 'utf-8')

      await writeFile(join(cursorDir, 'file2.mdc'), `---
---
## Rule: rule-two

**Severity:** warn

Guidance two.
`, 'utf-8')

      const rules = await importFromAgent('cursor', tmpDir)

      expect(rules).toHaveLength(2)
      expect(rules.map(r => r.id).sort()).toEqual(['rule-one', 'rule-two'])
    })

    it('should throw if .cursor/rules directory not found', async () => {
      await expect(importFromAgent('cursor', tmpDir)).rejects.toThrow(
        `.cursor/rules directory not found in ${tmpDir}`
      )
    })

    it('should throw if no .mdc files found', async () => {
      const cursorDir = join(tmpDir, '.cursor', 'rules')
      await mkdir(cursorDir, { recursive: true })

      await expect(importFromAgent('cursor', tmpDir)).rejects.toThrow(
        `No .mdc files found in ${cursorDir}`
      )
    })
  })

  describe('AGENTS.md import', () => {
    it('should import rules from AGENTS.md for copilot', async () => {
      const agentsMdContent = `# AGENTS.md

**Version:** v1

## Rule: test-rule

**ID:** test-rule
**Severity:** ERROR
**Scope:** **/*.ts

This is test guidance.
---
`
      await writeFile(join(tmpDir, 'AGENTS.md'), agentsMdContent, 'utf-8')

      const rules = await importFromAgent('copilot', tmpDir)

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatchObject({
        id: 'test-rule',
        severity: 'error',
        applies_to: ['**/*.ts'],
        guidance: 'This is test guidance.',
      })
    })

    it('should work for all universal agent types', async () => {
      const agentsMdContent = `# AGENTS.md

## Rule: test

**ID:** test
**Severity:** WARN

Test.
---
`
      await writeFile(join(tmpDir, 'AGENTS.md'), agentsMdContent, 'utf-8')

      for (const agent of ['copilot', 'claude-code', 'aider', 'agents-md']) {
        const rules = await importFromAgent(agent, tmpDir)
        expect(rules).toHaveLength(1)
        expect(rules[0].id).toBe('test')
      }
    })

    it('should throw if AGENTS.md not found', async () => {
      await expect(importFromAgent('copilot', tmpDir)).rejects.toThrow(
        `AGENTS.md not found in ${tmpDir}`
      )
    })

    it('should throw if AGENTS.md has no rules', async () => {
      await writeFile(join(tmpDir, 'AGENTS.md'), '# AGENTS.md\n\nNo rules here.\n', 'utf-8')

      await expect(importFromAgent('copilot', tmpDir)).rejects.toThrow(
        `No rules found in ${join(tmpDir, 'AGENTS.md')}`
      )
    })
  })

  describe('unsupported agents', () => {
    it('should throw for unsupported agents', async () => {
      await expect(importFromAgent('unknown', tmpDir)).rejects.toThrow(
        'Import not supported for agent: unknown'
      )
    })
  })
})

