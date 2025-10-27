/**
 * Tests for init command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import * as yaml from 'yaml'

// Note: Full integration tests will mock @clack/prompts
// For now, we test the utilities and template generation

describe('init command utilities', () => {
  describe('detectAgents', () => {
    let testDir: string

    beforeEach(() => {
      // Create a unique temp directory for each test
      testDir = join(tmpdir(), `aligntrue-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      // Clean up test directory
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true })
      }
    })

    it('detects no agents in empty directory', async () => {
      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      expect(result.detected).toEqual([])
      expect(result.recommended).toEqual([])
    })

    it('detects cursor when .cursor/ exists', async () => {
      mkdirSync(join(testDir, '.cursor'), { recursive: true })

      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      expect(result.detected).toContain('cursor')
      expect(result.displayNames.get('cursor')).toBe('Cursor')
    })

    it('detects agents-md when AGENTS.md exists', async () => {
      writeFileSync(join(testDir, 'AGENTS.md'), '# Agents')

      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      expect(result.detected).toContain('agents-md')
    })

    it('detects multiple agents', async () => {
      mkdirSync(join(testDir, '.cursor'), { recursive: true })
      mkdirSync(join(testDir, '.vscode'), { recursive: true })
      writeFileSync(join(testDir, 'AGENTS.md'), '# Agents')

      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      expect(result.detected.length).toBeGreaterThanOrEqual(2)
      expect(result.detected).toContain('cursor')
      expect(result.detected).toContain('agents-md')
    })

    it('detects cline when .clinerules exists', async () => {
      writeFileSync(join(testDir, '.clinerules'), 'test')

      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      expect(result.detected).toContain('cline')
    })

    it('detects amazonq when .amazonq/ exists', async () => {
      mkdirSync(join(testDir, '.amazonq'), { recursive: true })

      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      expect(result.detected).toContain('amazonq')
    })

    it('returns display names for all detected agents', async () => {
      mkdirSync(join(testDir, '.cursor'), { recursive: true })
      writeFileSync(join(testDir, 'AGENTS.md'), '# Agents')

      const { detectAgents } = await import('../../src/utils/detect-agents.js')
      const result = detectAgents(testDir)

      for (const agent of result.detected) {
        expect(result.displayNames.has(agent)).toBe(true)
        expect(result.displayNames.get(agent)).toBeTruthy()
      }
    })
  })

  describe('detectContext', () => {
    let testDir: string

    beforeEach(() => {
      testDir = join(tmpdir(), `aligntrue-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true })
      }
    })

    it('detects fresh-start in empty directory', async () => {
      const { detectContext } = await import('../../src/utils/detect-context.js')
      const result = detectContext(testDir)

      expect(result.context).toBe('fresh-start')
      expect(result.existingFiles).toEqual([])
    })

    it('detects already-initialized when .aligntrue/ exists', async () => {
      mkdirSync(join(testDir, '.aligntrue'), { recursive: true })

      const { detectContext } = await import('../../src/utils/detect-context.js')
      const result = detectContext(testDir)

      expect(result.context).toBe('already-initialized')
      expect(result.existingFiles).toContain('.aligntrue/')
    })

    it('detects import-cursor when .cursor/rules/ has .mdc files', async () => {
      const cursorRulesDir = join(testDir, '.cursor', 'rules')
      mkdirSync(cursorRulesDir, { recursive: true })
      writeFileSync(join(cursorRulesDir, 'test.mdc'), '# Test')

      const { detectContext } = await import('../../src/utils/detect-context.js')
      const result = detectContext(testDir)

      expect(result.context).toBe('import-cursor')
      expect(result.existingFiles).toContain('.cursor/rules/')
    })

    it('detects import-agents when AGENTS.md exists', async () => {
      writeFileSync(join(testDir, 'AGENTS.md'), '# Agents')

      const { detectContext } = await import('../../src/utils/detect-context.js')
      const result = detectContext(testDir)

      expect(result.context).toBe('import-agents')
      expect(result.existingFiles).toContain('AGENTS.md')
    })

    it('prioritizes .aligntrue/ over other detections', async () => {
      mkdirSync(join(testDir, '.aligntrue'), { recursive: true })
      mkdirSync(join(testDir, '.cursor', 'rules'), { recursive: true })
      writeFileSync(join(testDir, '.cursor', 'rules', 'test.mdc'), '# Test')

      const { detectContext } = await import('../../src/utils/detect-context.js')
      const result = detectContext(testDir)

      expect(result.context).toBe('already-initialized')
    })

    it('provides context descriptions', async () => {
      const { getContextDescription } = await import('../../src/utils/detect-context.js')

      expect(getContextDescription('fresh-start')).toBeTruthy()
      expect(getContextDescription('already-initialized')).toBeTruthy()
      expect(getContextDescription('import-cursor')).toBeTruthy()
      expect(getContextDescription('import-agents')).toBeTruthy()
    })
  })

  describe('getStarterTemplate', () => {
    it('generates valid markdown template', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('test-project')

      expect(template).toContain('# AlignTrue Rules')
      expect(template).toContain('```aligntrue')
      expect(template).toContain('id: test-project-rules')
      expect(template).toContain('spec_version: "1"')
    })

    it('includes all 5 example rules', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('my-project')

      expect(template).toContain('testing.require-tests')
      expect(template).toContain('docs.update-readme')
      expect(template).toContain('security.no-secrets')
      expect(template).toContain('style.consistent-naming')
      expect(template).toContain('performance.avoid-n-plus-one')
    })

    it('includes all severity levels', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('my-project')

      expect(template).toContain('severity: error')
      expect(template).toContain('severity: warn')
      expect(template).toContain('severity: info')
    })

    it('includes machine-checkable example', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('my-project')

      expect(template).toContain('check:')
      expect(template).toContain('type: regex')
      expect(template).toContain('pattern:')
    })

    it('includes vendor metadata example', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('my-project')

      expect(template).toContain('vendor:')
      expect(template).toContain('cursor:')
      expect(template).toContain('ai_hint:')
    })

    it('includes helpful documentation', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('my-project')

      expect(template).toContain('How it works')
      expect(template).toContain('Next steps')
      expect(template).toContain('Rule format reference')
    })

    it('uses custom project ID', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate('custom-id')

      expect(template).toContain('id: custom-id-rules')
    })

    it('defaults to my-project when no ID provided', async () => {
      const { getStarterTemplate } = await import('../../src/templates/starter-rules.js')
      const template = getStarterTemplate()

      expect(template).toContain('id: my-project-rules')
    })
  })

  describe('config generation', () => {
    it('generates valid solo mode config', () => {
      const config = {
        version: '1',
        mode: 'solo',
        sources: [
          {
            type: 'local',
            path: '.aligntrue/rules.md',
          },
        ],
        exporters: ['cursor', 'agents-md'],
      }

      const yamlString = yaml.stringify(config)
      expect(yamlString).toContain('mode: solo')
      expect(yamlString).toContain('type: local')
      expect(yamlString).toContain('path: .aligntrue/rules.md')

      // Verify it round-trips correctly
      const parsed = yaml.parse(yamlString)
      expect(parsed.mode).toBe('solo')
      expect(parsed.sources[0].type).toBe('local')
    })

    it('includes selected exporters', () => {
      const config = {
        version: '1',
        mode: 'solo',
        sources: [{ type: 'local', path: '.aligntrue/rules.md' }],
        exporters: ['cursor', 'agents-md', 'vscode-mcp'],
      }

      const yamlString = yaml.stringify(config)
      expect(yamlString).toContain('cursor')
      expect(yamlString).toContain('agents-md')
      expect(yamlString).toContain('vscode-mcp')
    })
  })

  describe('getAllAgents', () => {
    it('returns all 28+ agents', async () => {
      const { getAllAgents } = await import('../../src/utils/detect-agents.js')
      const agents = getAllAgents()

      expect(agents.length).toBeGreaterThanOrEqual(28)
      expect(agents).toContain('cursor')
      expect(agents).toContain('agents-md')
      expect(agents).toContain('vscode-mcp')
    })
  })
})

