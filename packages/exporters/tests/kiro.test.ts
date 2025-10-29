/**
 * Kiro exporter tests with mode hints support
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, rmSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { KiroExporter } from '../src/kiro/index.js'
import type { ScopedExportRequest, ExportOptions, ResolvedScope } from '../src/types.js'
import type { AlignRule } from '@aligntrue/schema'
import { parseYamlToJson } from '@aligntrue/schema'

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', 'cursor')
const TEST_OUTPUT_DIR = join(import.meta.dirname, 'temp-kiro-test-output')

describe('KiroExporter', () => {
  let exporter: KiroExporter

  beforeEach(() => {
    exporter = new KiroExporter()
    // Clean up test output directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true })
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
  })

  afterEach(() => {
    // Clean up test output directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true })
    }
  })

  describe('Plugin Interface', () => {
    it('implements ExporterPlugin interface', () => {
      expect(exporter.name).toBe('kiro')
      expect(exporter.version).toBe('1.0.0')
      expect(typeof exporter.export).toBe('function')
    })
  })

  describe('Basic Export', () => {
    it('exports single rule to .kiro/steering/ directory', async () => {
      const rules: AlignRule[] = [{
        id: 'test.rule.id',
        severity: 'error',
        applies_to: ['**/*'],
        guidance: 'Test guidance',
      }]

      const request = createRequest(rules, createDefaultScope())
      const options: ExportOptions = { outputDir: TEST_OUTPUT_DIR, dryRun: false }
      const result = await exporter.export(request, options)

      expect(result.success).toBe(true)
      expect(result.filesWritten).toHaveLength(1)
      expect(result.filesWritten[0]).toMatch(/\.kiro\/steering\/rules\.md$/)

      const content = readFileSync(result.filesWritten[0], 'utf-8')
      expect(content).toContain('Test guidance')
    })
  })

  describe('mode hints integration', () => {
    const options: ExportOptions = { outputDir: TEST_OUTPUT_DIR, dryRun: false }

    it('should support off mode (no markers)', async () => {
      const config = { export: { mode_hints: { default: 'off' } } }
      const request = createRequest(loadFixture('single-rule.yaml').rules, createDefaultScope())
      const result = await exporter.export(request, { ...options, config })
      expect(result.success).toBe(true)
      const content = readFileSync(result.filesWritten[0], 'utf-8')
      expect(content).not.toContain('aligntrue:begin')
    })

    it('should support metadata_only mode (markers, no hints)', async () => {
      const config = { export: { mode_hints: { default: 'metadata_only' } } }
      const request = createRequest(loadFixture('single-rule.yaml').rules, createDefaultScope())
      const result = await exporter.export(request, { ...options, config })
      expect(result.success).toBe(true)
      const content = readFileSync(result.filesWritten[0], 'utf-8')
      expect(content).toContain('<!-- aligntrue:begin')
      expect(content).not.toContain('Execution intent:')
    })

    it('should support hints mode (markers + visible intent)', async () => {
      const config = { export: { mode_hints: { default: 'hints' } } }
      const request = createRequest(loadFixture('single-rule.yaml').rules, createDefaultScope())
      const result = await exporter.export(request, { ...options, config })
      expect(result.success).toBe(true)
      const content = readFileSync(result.filesWritten[0], 'utf-8')
      expect(content).toContain('<!-- aligntrue:begin')
      expect(content).toContain('Execution intent:')
    })
  })
})

// Helper functions

function loadFixture(filename: string): { rules: AlignRule[] } {
  const filepath = join(FIXTURES_DIR, filename)
  const yaml = readFileSync(filepath, 'utf-8')
  const data = parseYamlToJson(yaml) as any
  return { rules: data.rules }
}

function createRequest(rules: AlignRule[], scope: ResolvedScope): ScopedExportRequest {
  return {
    scope,
    rules,
    outputPath: join(TEST_OUTPUT_DIR, '.kiro', 'steering', 'rules.md'),
  }
}

function createDefaultScope(): ResolvedScope {
  return {
    path: '.',
    normalizedPath: '.',
    isDefault: true,
    include: ['**/*'],
  }
}
