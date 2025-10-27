/**
 * Tests for GitIntegration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { GitIntegration, type GitMode } from '../../src/sync/git-integration.js'

const TEST_DIR = join(process.cwd(), 'packages/core/tests/temp-git-integration')

describe('GitIntegration', () => {
  let gitIntegration: GitIntegration

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmdirSync(TEST_DIR, { recursive: true })
    }
    mkdirSync(TEST_DIR, { recursive: true })
    gitIntegration = new GitIntegration()
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      try {
        rmdirSync(TEST_DIR, { recursive: true })
      } catch {
        // Ignore errors
      }
    }
  })

  describe('ignore mode', () => {
    it('adds generated files to .gitignore', async () => {
      const files = ['.cursor/rules/aligntrue.mdc', 'AGENTS.md']
      
      const result = await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      })
      
      expect(result.mode).toBe('ignore')
      expect(result.action).toBe('added to .gitignore')
      expect(result.filesAffected).toEqual(files)
      
      const gitignorePath = join(TEST_DIR, '.gitignore')
      expect(existsSync(gitignorePath)).toBe(true)
      
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('.cursor/rules/aligntrue.mdc')
      expect(content).toContain('AGENTS.md')
    })

    it('is idempotent (does not duplicate entries)', async () => {
      const files = ['.cursor/rules/aligntrue.mdc']
      
      // First call
      await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      })
      
      // Second call
      await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      })
      
      const gitignorePath = join(TEST_DIR, '.gitignore')
      const content = readFileSync(gitignorePath, 'utf-8')
      
      // Count occurrences
      const matches = content.match(/\.cursor\/rules\/aligntrue\.mdc/g)
      expect(matches).toHaveLength(1)
    })

    it('preserves existing .gitignore content', async () => {
      const gitignorePath = join(TEST_DIR, '.gitignore')
      const existingContent = 'node_modules/\ndist/\n'
      writeFileSync(gitignorePath, existingContent, 'utf-8')
      
      await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: ['.cursor/rules/aligntrue.mdc'],
      })
      
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('node_modules/')
      expect(content).toContain('dist/')
      expect(content).toContain('.cursor/rules/aligntrue.mdc')
    })

    it('normalizes patterns (removes leading ./)', async () => {
      await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: ['./.cursor/rules/aligntrue.mdc'],
      })
      
      const content = readFileSync(join(TEST_DIR, '.gitignore'), 'utf-8')
      expect(content).toContain('.cursor/rules/aligntrue.mdc')
      expect(content).not.toContain('./.cursor/')
    })
  })

  describe('commit mode', () => {
    it('prepares files for commit', async () => {
      const files = ['.cursor/rules/aligntrue.mdc', 'AGENTS.md']
      
      const result = await gitIntegration.apply({
        mode: 'commit',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      })
      
      expect(result.mode).toBe('commit')
      expect(result.action).toBe('ready to commit')
      expect(result.filesAffected).toEqual(files)
    })

    it('does not modify .gitignore', async () => {
      const gitignorePath = join(TEST_DIR, '.gitignore')
      const initialContent = 'node_modules/\n'
      writeFileSync(gitignorePath, initialContent, 'utf-8')
      
      await gitIntegration.apply({
        mode: 'commit',
        workspaceRoot: TEST_DIR,
        generatedFiles: ['.cursor/rules/aligntrue.mdc'],
      })
      
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toBe(initialContent)
    })
  })

  describe('branch mode', () => {
    beforeEach(() => {
      // Initialize git repo
      try {
        execSync('git init', { cwd: TEST_DIR, stdio: 'pipe' })
        execSync('git config user.email "test@example.com"', { cwd: TEST_DIR, stdio: 'pipe' })
        execSync('git config user.name "Test User"', { cwd: TEST_DIR, stdio: 'pipe' })
        
        // Create initial commit
        const readmePath = join(TEST_DIR, 'README.md')
        writeFileSync(readmePath, '# Test Repo\n', 'utf-8')
        execSync('git add README.md', { cwd: TEST_DIR, stdio: 'pipe' })
        execSync('git commit -m "Initial commit"', { cwd: TEST_DIR, stdio: 'pipe' })
      } catch (error) {
        // Ignore git setup errors in CI
      }
    })

    it('creates feature branch and stages files', async () => {
      // Create files to stage
      const cursorDir = join(TEST_DIR, '.cursor', 'rules')
      mkdirSync(cursorDir, { recursive: true })
      writeFileSync(join(cursorDir, 'aligntrue.mdc'), '# Test Rule\n', 'utf-8')
      writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Test Agents\n', 'utf-8')
      
      const result = await gitIntegration.apply({
        mode: 'branch',
        workspaceRoot: TEST_DIR,
        generatedFiles: ['.cursor/rules/aligntrue.mdc', 'AGENTS.md'],
      })
      
      expect(result.mode).toBe('branch')
      expect(result.action).toBe('created branch and staged files')
      expect(result.branchCreated).toMatch(/^aligntrue\/sync-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)
      
      // Verify branch was created
      const currentBranch = execSync('git branch --show-current', {
        cwd: TEST_DIR,
        encoding: 'utf-8',
      }).trim()
      
      expect(currentBranch).toBe(result.branchCreated)
    })

    it('accepts custom branch name', async () => {
      const cursorDir = join(TEST_DIR, '.cursor', 'rules')
      mkdirSync(cursorDir, { recursive: true })
      writeFileSync(join(cursorDir, 'aligntrue.mdc'), '# Test Rule\n', 'utf-8')
      
      const customBranch = 'feature/custom-rules-sync'
      
      const result = await gitIntegration.apply({
        mode: 'branch',
        workspaceRoot: TEST_DIR,
        generatedFiles: ['.cursor/rules/aligntrue.mdc'],
        branchName: customBranch,
      })
      
      expect(result.branchCreated).toBe(customBranch)
    })

    it('throws error for non-git workspace', async () => {
      const nonGitDir = join(TEST_DIR, 'non-git')
      mkdirSync(nonGitDir, { recursive: true })
      
      await expect(
        gitIntegration.apply({
          mode: 'branch',
          workspaceRoot: nonGitDir,
          generatedFiles: ['AGENTS.md'],
        })
      ).rejects.toThrow(/git repository/)
    })
  })

  describe('per-adapter overrides', () => {
    it('applies different modes per adapter', async () => {
      // Create files
      const cursorDir = join(TEST_DIR, '.cursor', 'rules')
      mkdirSync(cursorDir, { recursive: true })
      writeFileSync(join(cursorDir, 'aligntrue.mdc'), '# Cursor\n', 'utf-8')
      writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Agents\n', 'utf-8')
      
      const result = await gitIntegration.apply({
        mode: 'ignore', // default
        workspaceRoot: TEST_DIR,
        generatedFiles: ['.cursor/rules/aligntrue.mdc', 'AGENTS.md'],
        perAdapterOverrides: {
          'agents-md': 'commit', // AGENTS.md should be committed
        },
      })
      
      // Cursor files should be in .gitignore
      const gitignorePath = join(TEST_DIR, '.gitignore')
      expect(existsSync(gitignorePath)).toBe(true)
      
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('.cursor/rules/aligntrue.mdc')
      // AGENTS.md should NOT be in .gitignore (commit mode)
      expect(content).not.toContain('AGENTS.md')
    })

    it('infers adapter from file path', async () => {
      const files = [
        '.cursor/rules/global.mdc',
        '.vscode/mcp.json',
        'AGENTS.md',
        '.amazonq/rules/test.md',
        '.windsurf/mcp_config.json',
      ]
      
      const result = await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
        perAdapterOverrides: {
          cursor: 'commit',
          'vscode-mcp': 'commit',
        },
      })
      
      const gitignorePath = join(TEST_DIR, '.gitignore')
      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, 'utf-8')
        
        // Cursor and VS Code should NOT be in .gitignore (commit mode)
        expect(content).not.toContain('.cursor/')
        expect(content).not.toContain('.vscode/')
        
        // Others should be in .gitignore (default ignore mode)
        expect(content).toContain('AGENTS.md')
        expect(content).toContain('.amazonq/')
        expect(content).toContain('.windsurf/')
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty file list', async () => {
      const result = await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: [],
      })
      
      expect(result.action).toBe('no files to process')
      expect(result.filesAffected).toEqual([])
    })

    it('handles files with special characters', async () => {
      const files = ['.cursor/rules/special-chars-🎉.mdc']
      
      const result = await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      })
      
      const gitignorePath = join(TEST_DIR, '.gitignore')
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('special-chars-🎉.mdc')
    })

    it('handles deeply nested paths', async () => {
      const files = ['a/b/c/d/e/f/deep.mdc']
      
      const result = await gitIntegration.apply({
        mode: 'ignore',
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      })
      
      const gitignorePath = join(TEST_DIR, '.gitignore')
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('a/b/c/d/e/f/deep.mdc')
    })
  })
})

