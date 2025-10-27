/**
 * Tests for IR loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from 'fs'
import { join } from 'path'
import { loadIR } from '../../src/sync/ir-loader.js'

const TEST_DIR = join(process.cwd(), 'packages/core/tests/sync/fixtures')

describe('IR Loader', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up test files
    const testFiles = [
      'valid.md',
      'valid.yaml',
      'invalid-yaml.yaml',
      'invalid-markdown.md',
      'unsupported.txt',
    ]

    for (const file of testFiles) {
      const path = join(TEST_DIR, file)
      if (existsSync(path)) {
        try {
          unlinkSync(path)
        } catch {
          // Ignore errors
        }
      }
    }
  })

  describe('Load from markdown', () => {
    it('loads valid markdown with fenced blocks', async () => {
      const markdown = `# Test Rules

Some guidance here.

\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
\`\`\`
`
      const path = join(TEST_DIR, 'valid.md')
      writeFileSync(path, markdown, 'utf8')

      const ir = await loadIR(path)

      expect(ir.id).toBe('test-pack')
      expect(ir.version).toBe('1.0.0')
      expect(ir.spec_version).toBe('1')
      expect(ir.rules).toHaveLength(1)
      expect(ir.rules![0].id).toBe('test-rule')
    })

    it('fails on invalid markdown (multiple blocks)', async () => {
      const markdown = `# Test

\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules: []
\`\`\`

\`\`\`aligntrue
id: test-pack2
version: 1.0.0
spec_version: "1"
rules: []
\`\`\`
`
      const path = join(TEST_DIR, 'invalid-markdown.md')
      writeFileSync(path, markdown, 'utf8')

      await expect(loadIR(path)).rejects.toThrow(/only one block|Only one block/i)
    })

    it('surfaces markdown line numbers in errors', async () => {
      const markdown = `# Test Rules

\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: invalid rule id
    severity: warn
\`\`\`
`
      const path = join(TEST_DIR, 'invalid-markdown.md')
      writeFileSync(path, markdown, 'utf8')

      await expect(loadIR(path)).rejects.toThrow(/line|markdown/i)
    })
  })

  describe('Load from YAML', () => {
    it('loads valid YAML', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
`
      const path = join(TEST_DIR, 'valid.yaml')
      writeFileSync(path, yaml, 'utf8')

      const ir = await loadIR(path)

      expect(ir.id).toBe('test-pack')
      expect(ir.version).toBe('1.0.0')
      expect(ir.spec_version).toBe('1')
      expect(ir.rules).toHaveLength(1)
      expect(ir.rules![0].id).toBe('test-rule')
    })

    it('fails on invalid YAML syntax', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    guidance: "unclosed string
`
      const path = join(TEST_DIR, 'invalid-yaml.yaml')
      writeFileSync(path, yaml, 'utf8')

      await expect(loadIR(path)).rejects.toThrow(/line|column/)
    })

    it('surfaces YAML line numbers in errors', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: invalid rule id
    severity: warn
`
      const path = join(TEST_DIR, 'invalid-yaml.yaml')
      writeFileSync(path, yaml, 'utf8')

      await expect(loadIR(path)).rejects.toThrow()
    })
  })

  describe('Format auto-detection', () => {
    it('detects .md extension', async () => {
      const markdown = `\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules: []
\`\`\`
`
      const path = join(TEST_DIR, 'valid.md')
      writeFileSync(path, markdown, 'utf8')

      const ir = await loadIR(path)
      expect(ir.id).toBe('test-pack')
    })

    it('detects .yaml extension', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules: []
`
      const path = join(TEST_DIR, 'valid.yaml')
      writeFileSync(path, yaml, 'utf8')

      const ir = await loadIR(path)
      expect(ir.id).toBe('test-pack')
    })

    it('rejects unsupported extensions', async () => {
      const path = join(TEST_DIR, 'unsupported.txt')
      writeFileSync(path, 'invalid', 'utf8')

      await expect(loadIR(path)).rejects.toThrow(/Unsupported file format/)
    })
  })

  describe('Error handling', () => {
    it('fails on non-existent file', async () => {
      const path = join(TEST_DIR, 'nonexistent.yaml')

      await expect(loadIR(path)).rejects.toThrow(/not found/)
    })

    it('fails on invalid IR schema', async () => {
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: invalid_severity
`
      const path = join(TEST_DIR, 'invalid-yaml.yaml')
      writeFileSync(path, yaml, 'utf8')

      await expect(loadIR(path)).rejects.toThrow(/Invalid IR/)
    })
  })
})

