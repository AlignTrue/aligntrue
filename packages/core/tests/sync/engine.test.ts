/**
 * Tests for sync engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from 'fs'
import { join } from 'path'
import { SyncEngine } from '../../src/sync/engine.js'
import { MockExporter } from '../mocks/mock-exporter.js'
import { FailingExporter } from '../mocks/failing-exporter.js'

const TEST_DIR = join(process.cwd(), 'packages/core/tests/sync/temp-engine')
const CONFIG_DIR = join(TEST_DIR, '.aligntrue')

describe('SyncEngine', () => {
  let engine: SyncEngine

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true })
    }
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }

    engine = new SyncEngine()
  })

  afterEach(() => {
    engine.clear()

    // Clean up test files
    if (existsSync(TEST_DIR)) {
      try {
        rmdirSync(TEST_DIR, { recursive: true })
      } catch {
        // Ignore errors
      }
    }
  })

  describe('registerExporter', () => {
    it('registers an exporter plugin', () => {
      const exporter = new MockExporter('test-exporter')

      engine.registerExporter(exporter)

      // Exporter should be available for sync operations
      expect(() => engine.registerExporter(exporter)).not.toThrow()
    })

    it('allows multiple exporters', () => {
      const exporter1 = new MockExporter('exporter1')
      const exporter2 = new MockExporter('exporter2')

      engine.registerExporter(exporter1)
      engine.registerExporter(exporter2)

      // Both should be registered
      expect(() => engine.registerExporter(exporter1)).not.toThrow()
      expect(() => engine.registerExporter(exporter2)).not.toThrow()
    })
  })

  describe('loadConfiguration', () => {
    it('loads config from default path', async () => {
      const config = `version: "1"
mode: solo
exporters:
  - cursor
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      writeFileSync(configPath, config, 'utf8')

      await expect(engine.loadConfiguration(configPath)).resolves.not.toThrow()
    })

    it('fails on missing config', async () => {
      const configPath = join(CONFIG_DIR, 'nonexistent.yaml')

      await expect(engine.loadConfiguration(configPath)).rejects.toThrow(/not found/)
    })

    it('fails on invalid config', async () => {
      const config = `version: "1"
mode: invalid_mode
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      writeFileSync(configPath, config, 'utf8')

      await expect(engine.loadConfiguration(configPath)).rejects.toThrow()
    })
  })

  describe('loadIRFromSource', () => {
    it('loads IR from markdown', async () => {
      const markdown = `# Test Pack

\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(irPath, markdown, 'utf8')

      await expect(engine.loadIRFromSource(irPath)).resolves.not.toThrow()
    })

    it('loads IR from YAML', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
`
      const irPath = join(TEST_DIR, 'rules.yaml')
      writeFileSync(irPath, yaml, 'utf8')

      await expect(engine.loadIRFromSource(irPath)).resolves.not.toThrow()
    })

    it('fails on invalid IR', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: invalid_severity
`
      const irPath = join(TEST_DIR, 'invalid.yaml')
      writeFileSync(irPath, yaml, 'utf8')

      await expect(engine.loadIRFromSource(irPath)).rejects.toThrow(/Invalid IR/)
    })
  })

  describe('syncToAgents', () => {
    it('syncs IR to agents successfully', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const mockExporter = new MockExporter('test-exporter')
        .setFilesToWrite([join(TEST_DIR, 'output.txt')])
      engine.registerExporter(mockExporter)

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true, // Don't actually write files
      })

      // Verify
      expect(result.success).toBe(true)
      expect(mockExporter.getCallCount()).toBe(1)
      expect(mockExporter.lastRequest?.rules).toHaveLength(1)
      expect(mockExporter.lastRequest?.rules[0].id).toBe('testing.example.rule')
    })

    it('supports dry-run mode', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const mockExporter = new MockExporter('test-exporter')
        .setFilesToWrite([join(TEST_DIR, 'output.txt')])
      engine.registerExporter(mockExporter)

      // Execute with dry-run
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify exporter was called with dryRun option
      expect(result.success).toBe(true)
      expect(mockExporter.lastOptions?.dryRun).toBe(true)
    })

    it('calls multiple exporters', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - exporter1
  - exporter2
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const exporter1 = new MockExporter('exporter1')
      const exporter2 = new MockExporter('exporter2')
      engine.registerExporter(exporter1)
      engine.registerExporter(exporter2)

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify both were called
      expect(result.success).toBe(true)
      expect(exporter1.getCallCount()).toBe(1)
      expect(exporter2.getCallCount()).toBe(1)
    })

    it('applies scope resolution', async () => {
      // Setup with scopes
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
scopes:
  - path: apps/web
    include:
      - "**/*.ts"
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const mockExporter = new MockExporter('test-exporter')
      engine.registerExporter(mockExporter)

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify scope was passed to exporter
      expect(result.success).toBe(true)
      expect(mockExporter.lastRequest?.scope.path).toBe('apps/web')
    })

    it('warns when exporter not found', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - missing-exporter
  - test-exporter
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const mockExporter = new MockExporter('test-exporter')
      engine.registerExporter(mockExporter)

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify warning was issued
      expect(result.success).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.some(w => w.includes('missing-exporter'))).toBe(true)
    })

    it('collects fidelity notes as warnings', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const mockExporter = new MockExporter('test-exporter')
        .setFidelityNotes(['Feature X not supported', 'Using fallback for Y'])
      engine.registerExporter(mockExporter)

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify fidelity notes in warnings
      expect(result.success).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.length).toBeGreaterThan(0)
      expect(result.warnings?.some(w => w.includes('Feature X'))).toBe(true)
    })

    it('fails when all exporters are missing', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - missing-exporter
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify failure
      expect(result.success).toBe(false)
      expect(result.warnings?.some(w => w.includes('No active exporters'))).toBe(true)
    })

    it('handles exporter errors gracefully', async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - failing-exporter
`
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(irPath, markdown, 'utf8')

      const failingExporter = new FailingExporter('failing-exporter', true)
      engine.registerExporter(failingExporter)

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      })

      // Verify failure
      expect(result.success).toBe(false)
      expect(result.warnings?.[0]).toContain('Export failed')
    })
  })

  describe('syncFromAgent', () => {
    it('loads agent rules with mock implementation', async () => {
      // Setup: create config and rules files
      const config = `version: "1"
mode: solo
sources:
  - type: local
    path: rules.md
exporters: ['cursor']
`
      const rules = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const configPath = join(CONFIG_DIR, 'config.yaml')
      const rulesPath = join(TEST_DIR, 'rules.md')
      writeFileSync(configPath, config, 'utf8')
      writeFileSync(rulesPath, rules, 'utf8')

      const result = await engine.syncFromAgent('cursor', rulesPath, { configPath })

      // Should fail because .cursor/rules directory doesn't exist in test environment
      expect(result.success).toBe(false)
      expect(result.warnings?.[0]).toContain('.cursor/rules directory not found')
    })
  })

  describe('detectConflicts', () => {
    it('delegates to conflict detector', () => {
      const irRules = [
        {
          id: 'test.rule',
          severity: 'warn' as const,
          guidance: 'Test',
        },
      ]

      const agentRules = [
        {
          id: 'test.rule',
          severity: 'error' as const,
          guidance: 'Test',
        },
      ]

      const conflicts = engine.detectConflicts('cursor', irRules, agentRules)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].field).toBe('severity')
    })
  })

  describe('clear', () => {
    it('clears internal state', async () => {
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const irPath = join(TEST_DIR, 'rules.md')
      writeFileSync(irPath, markdown, 'utf8')

      await engine.loadIRFromSource(irPath)
      engine.clear()

      // Should be able to load again without issues
      await expect(engine.loadIRFromSource(irPath)).resolves.not.toThrow()
    })
  })
})

