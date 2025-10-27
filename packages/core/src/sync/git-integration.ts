/**
 * Git integration for managing generated files
 * Supports three modes: ignore, commit, branch
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

export type GitMode = 'ignore' | 'commit' | 'branch'

export interface GitIntegrationOptions {
  mode: GitMode
  workspaceRoot: string
  generatedFiles: string[]
  perAdapterOverrides?: Record<string, GitMode>
  branchName?: string
}

export interface GitModeResult {
  mode: GitMode
  action: string
  filesAffected: string[]
  branchCreated?: string
}

export class GitIntegration {
  /**
   * Apply git integration based on mode
   */
  async apply(options: GitIntegrationOptions): Promise<GitModeResult> {
    const { mode, generatedFiles, perAdapterOverrides } = options
    
    // Group files by effective mode (considering per-adapter overrides)
    const filesByMode = this.groupFilesByMode(generatedFiles, mode, perAdapterOverrides)
    
    const results: GitModeResult[] = []
    
    // Apply each mode
    for (const [effectiveMode, files] of Object.entries(filesByMode)) {
      if (files.length === 0) continue
      
      switch (effectiveMode as GitMode) {
        case 'ignore':
          results.push(await this.applyIgnoreMode(options.workspaceRoot, files))
          break
        case 'commit':
          results.push(await this.applyCommitMode(options.workspaceRoot, files))
          break
        case 'branch':
          results.push(await this.applyBranchMode(options.workspaceRoot, files, options.branchName))
          break
      }
    }
    
    // Return primary mode result
    return results[0] || {
      mode,
      action: 'no files to process',
      filesAffected: [],
    }
  }

  /**
   * Group files by effective mode considering per-adapter overrides
   */
  private groupFilesByMode(
    files: string[],
    defaultMode: GitMode,
    overrides?: Record<string, GitMode>
  ): Record<GitMode, string[]> {
    const grouped: Record<GitMode, string[]> = {
      ignore: [],
      commit: [],
      branch: [],
    }
    
    for (const file of files) {
      // Determine adapter from file path
      const adapter = this.inferAdapterFromPath(file)
      const effectiveMode = (overrides && adapter && overrides[adapter]) || defaultMode
      grouped[effectiveMode].push(file)
    }
    
    return grouped
  }

  /**
   * Infer adapter name from file path
   */
  private inferAdapterFromPath(filePath: string): string | null {
    if (filePath.includes('.cursor/')) return 'cursor'
    if (filePath === 'AGENTS.md') return 'agents-md'
    if (filePath.includes('.vscode/mcp.json')) return 'vscode-mcp'
    if (filePath.includes('.amazonq/')) return 'amazonq'
    if (filePath.includes('.windsurf/')) return 'windsurf'
    // Add more as needed
    return null
  }

  /**
   * Apply ignore mode: add files to .gitignore
   */
  private async applyIgnoreMode(workspaceRoot: string, files: string[]): Promise<GitModeResult> {
    const gitignorePath = join(workspaceRoot, '.gitignore')
    
    for (const file of files) {
      await this.ensureGitignoreEntry(gitignorePath, file)
    }
    
    return {
      mode: 'ignore',
      action: 'added to .gitignore',
      filesAffected: files,
    }
  }

  /**
   * Apply commit mode: do nothing special (files will be tracked)
   */
  private async applyCommitMode(workspaceRoot: string, files: string[]): Promise<GitModeResult> {
    // Ensure files are NOT in .gitignore
    const gitignorePath = join(workspaceRoot, '.gitignore')
    
    if (existsSync(gitignorePath)) {
      // Note: We don't automatically remove from .gitignore in commit mode
      // to avoid conflicts. User should manage .gitignore manually or use migrate command.
    }
    
    return {
      mode: 'commit',
      action: 'ready to commit',
      filesAffected: files,
    }
  }

  /**
   * Apply branch mode: create feature branch and stage files
   */
  private async applyBranchMode(
    workspaceRoot: string,
    files: string[],
    branchName?: string
  ): Promise<GitModeResult> {
    // Check if workspace is a git repo
    if (!this.isGitRepo(workspaceRoot)) {
      throw new Error('Git branch mode requires a git repository. Initialize git first: git init')
    }
    
    // Generate branch name if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const branch = branchName || `aligntrue/sync-${timestamp}`
    
    try {
      // Create and checkout new branch
      execSync(`git checkout -b "${branch}"`, {
        cwd: workspaceRoot,
        stdio: 'pipe',
      })
      
      // Stage the generated files
      for (const file of files) {
        const fullPath = join(workspaceRoot, file)
        if (existsSync(fullPath)) {
          execSync(`git add "${file}"`, {
            cwd: workspaceRoot,
            stdio: 'pipe',
          })
        }
      }
      
      return {
        mode: 'branch',
        action: 'created branch and staged files',
        filesAffected: files,
        branchCreated: branch,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create git branch: ${message}`)
    }
  }

  /**
   * Ensure a pattern exists in .gitignore (idempotent)
   */
  private async ensureGitignoreEntry(gitignorePath: string, pattern: string): Promise<void> {
    // Normalize pattern (remove leading ./)
    const normalizedPattern = pattern.replace(/^\.\//, '')
    
    if (!existsSync(gitignorePath)) {
      // Create new .gitignore
      writeFileSync(gitignorePath, `# AlignTrue generated files\n${normalizedPattern}\n`, 'utf-8')
      return
    }
    
    // Check if pattern already exists
    const content = readFileSync(gitignorePath, 'utf-8')
    const lines = content.split('\n')
    
    if (lines.some(line => line.trim() === normalizedPattern)) {
      // Already exists, skip
      return
    }
    
    // Append to .gitignore
    const hasTrailingNewline = content.endsWith('\n')
    const prefix = hasTrailingNewline ? '' : '\n'
    appendFileSync(gitignorePath, `${prefix}# AlignTrue generated\n${normalizedPattern}\n`, 'utf-8')
  }

  /**
   * Check if directory is a git repository
   */
  private isGitRepo(workspaceRoot: string): boolean {
    const gitDir = join(workspaceRoot, '.git')
    return existsSync(gitDir)
  }
}

