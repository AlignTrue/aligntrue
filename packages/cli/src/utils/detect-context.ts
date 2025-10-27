/**
 * Context detection for init command
 * Determines what user flow to offer based on project state
 */

import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Project context types
 */
export type ProjectContext =
  | 'already-initialized' // Has .aligntrue/ directory
  | 'import-cursor'        // Has .cursor/rules/ but no .aligntrue/
  | 'import-agents'        // Has AGENTS.md but no .aligntrue/
  | 'fresh-start'          // No existing rules or config

/**
 * Result of context detection
 */
export interface ContextResult {
  /** Detected context type */
  context: ProjectContext
  /** Existing files found */
  existingFiles: string[]
}

/**
 * Detect project context to determine init flow
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns Context result with detected type and existing files
 */
export function detectContext(cwd: string = process.cwd()): ContextResult {
  const existingFiles: string[] = []

  // Check for .aligntrue/ directory
  const aligntruePath = join(cwd, '.aligntrue')
  if (existsSync(aligntruePath) && statSync(aligntruePath).isDirectory()) {
    existingFiles.push('.aligntrue/')
    return {
      context: 'already-initialized',
      existingFiles,
    }
  }

  // Check for .cursor/rules/ directory
  const cursorRulesPath = join(cwd, '.cursor', 'rules')
  if (existsSync(cursorRulesPath) && statSync(cursorRulesPath).isDirectory()) {
    // Check if it has any .mdc files
    try {
      const files = readdirSync(cursorRulesPath)
      const mdcFiles = files.filter(f => f.endsWith('.mdc'))
      if (mdcFiles.length > 0) {
        existingFiles.push('.cursor/rules/')
        return {
          context: 'import-cursor',
          existingFiles,
        }
      }
    } catch (err) {
      // Directory not readable, continue
    }
  }

  // Check for AGENTS.md
  const agentsMdPath = join(cwd, 'AGENTS.md')
  if (existsSync(agentsMdPath)) {
    existingFiles.push('AGENTS.md')
    return {
      context: 'import-agents',
      existingFiles,
    }
  }

  // Default: fresh start
  return {
    context: 'fresh-start',
    existingFiles: [],
  }
}

/**
 * Get human-readable description of context
 */
export function getContextDescription(context: ProjectContext): string {
  switch (context) {
    case 'already-initialized':
      return 'AlignTrue already initialized'
    case 'import-cursor':
      return 'Existing Cursor rules found'
    case 'import-agents':
      return 'Existing AGENTS.md found'
    case 'fresh-start':
      return 'Starting fresh'
  }
}

