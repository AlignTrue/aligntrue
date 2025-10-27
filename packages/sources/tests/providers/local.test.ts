/**
 * Tests for LocalProvider
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmdirSync, existsSync } from 'fs'
import { join } from 'path'
import { LocalProvider } from '../../src/providers/local.js'

const TEST_DIR = join(process.cwd(), 'packages/sources/tests/temp-local-provider')

describe('LocalProvider', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true })
    }
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

  describe('fetch', () => {
    it('reads a valid file', async () => {
      const provider = new LocalProvider(TEST_DIR)
      const filePath = 'test.txt'
      const content = 'test content'
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })

    it('reads files from nested directories', async () => {
      const subDir = join(TEST_DIR, 'nested', 'dir')
      mkdirSync(subDir, { recursive: true })
      
      const provider = new LocalProvider(TEST_DIR)
      const filePath = 'nested/dir/test.yaml'
      const content = 'nested: true'
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })

    it('throws on file not found', async () => {
      const provider = new LocalProvider(TEST_DIR)
      
      await expect(provider.fetch('nonexistent.txt')).rejects.toThrow(/File not found/)
    })

    it('prevents path traversal attacks', async () => {
      const provider = new LocalProvider(TEST_DIR)
      
      await expect(provider.fetch('../../../etc/passwd')).rejects.toThrow(/path traversal/)
      await expect(provider.fetch('../../sensitive.txt')).rejects.toThrow(/path traversal/)
      await expect(provider.fetch('test/../../../etc/passwd')).rejects.toThrow(/path traversal/)
    })

    it('handles absolute base paths', async () => {
      const provider = new LocalProvider(TEST_DIR) // absolute path
      const filePath = 'test.txt'
      const content = 'absolute path test'
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })

    it('handles relative base paths', async () => {
      // Create provider with relative path
      const relativePath = 'packages/sources/tests/temp-local-provider'
      const provider = new LocalProvider(relativePath)
      const filePath = 'relative.txt'
      const content = 'relative path test'
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })

    it('preserves UTF-8 encoding', async () => {
      const provider = new LocalProvider(TEST_DIR)
      const filePath = 'utf8.txt'
      const content = '日本語 UTF-8 テスト 🎉'
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })

    it('reads YAML files correctly', async () => {
      const provider = new LocalProvider(TEST_DIR)
      const filePath = 'rules.yaml'
      const content = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]
`
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })

    it('reads markdown files correctly', async () => {
      const provider = new LocalProvider(TEST_DIR)
      const filePath = 'rules.md'
      const content = `# Test Rules

\`\`\`aligntrue
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]
\`\`\`
`
      
      writeFileSync(join(TEST_DIR, filePath), content, 'utf-8')
      
      const result = await provider.fetch(filePath)
      expect(result).toBe(content)
    })
  })

  describe('type', () => {
    it('has correct type identifier', () => {
      const provider = new LocalProvider(TEST_DIR)
      expect(provider.type).toBe('local')
    })
  })
})

