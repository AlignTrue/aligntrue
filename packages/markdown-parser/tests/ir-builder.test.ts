import { describe, it, expect } from 'vitest'
import { buildIR, normalizeWhitespace, detectIndentStyle, detectLineEndings, extractHeaderPrefix } from '../src/ir-builder.js'

describe('buildIR', () => {
  it('converts valid YAML block to IR', () => {
    const blocks = [
      {
        content: `id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]`,
        startLine: 1,
        endLine: 8,
      },
    ]
    
    const result = buildIR(blocks)
    
    expect(result.errors).toEqual([])
    expect(result.document).toBeDefined()
    expect(result.document?.id).toBe('test-rules')
    expect(result.document?.source_format).toBe('markdown')
  })

  it('merges guidance from prose into IR', () => {
    const blocks = [
      {
        content: `id: test-rules
version: 1.0.0
spec_version: "1"
rules: []`,
        startLine: 1,
        endLine: 5,
        guidanceBefore: 'This is guidance from markdown prose.',
      },
    ]
    
    const result = buildIR(blocks)
    
    expect(result.errors).toEqual([])
    expect(result.document?.guidance).toBe('This is guidance from markdown prose.')
  })

  it('fails on invalid YAML', () => {
    const blocks = [
      {
        content: `id: test-rules
  invalid: yaml: structure`,
        startLine: 1,
        endLine: 3,
      },
    ]
    
    const result = buildIR(blocks)
    
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.document).toBeUndefined()
  })

  it('fails on missing required fields', () => {
    const blocks = [
      {
        content: `version: 1.0.0`,
        startLine: 1,
        endLine: 2,
      },
    ]
    
    const result = buildIR(blocks)
    
    // This should build but create a placeholder document
    // Schema validation will catch missing required fields
    expect(result.document).toBeDefined()
  })

  it('handles empty blocks array', () => {
    const result = buildIR([])
    
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.message).toContain('No aligntrue blocks found')
  })

  it('preserves vendor fields', () => {
    const blocks = [
      {
        content: `id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]
    vendor:
      cursor:
        ai_hint: "Test hint"`,
        startLine: 1,
        endLine: 11,
      },
    ]
    
    const result = buildIR(blocks)
    
    expect(result.errors).toEqual([])
    expect(result.document?.rules).toHaveLength(1)
    const rule = result.document?.rules[0] as Record<string, unknown>
    expect(rule?.vendor).toBeDefined()
  })

  it('builds document from multiple rule blocks', () => {
    const blocks = [
      {
        content: `id: rule-1
severity: warn
applies_to: ["**/*.ts"]`,
        startLine: 1,
        endLine: 4,
        sectionTitle: 'Rule 1',
      },
      {
        content: `id: rule-2
severity: error
applies_to: ["**/*.js"]`,
        startLine: 6,
        endLine: 9,
        sectionTitle: 'Rule 2',
      },
    ]
    
    const result = buildIR(blocks)
    
    // When blocks are individual rules (no id/version in block), 
    // creates placeholder document
    expect(result.document).toBeDefined()
    expect(result.document?.rules).toHaveLength(2)
  })

  it('reports section info in errors', () => {
    const blocks = [
      {
        content: `invalid yaml: {{{`,
        startLine: 5,
        endLine: 7,
        sectionTitle: 'Testing Rules',
      },
    ]
    
    const result = buildIR(blocks)
    
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]?.section).toBe('Testing Rules')
    expect(result.errors[0]?.line).toBe(5)
  })
})

describe('normalizeWhitespace', () => {
  it('converts tabs to 2 spaces', () => {
    const yaml = 'id: test\n\tname: value'
    const normalized = normalizeWhitespace(yaml)
    
    expect(normalized).toBe('id: test\n  name: value\n')
  })

  it('removes trailing whitespace from lines', () => {
    const yaml = 'id: test   \nname: value  '
    const normalized = normalizeWhitespace(yaml)
    
    expect(normalized).toBe('id: test\nname: value\n')
  })

  it('ensures single newline at EOF', () => {
    const yaml1 = 'id: test'
    const yaml2 = 'id: test\n\n\n'
    
    const normalized1 = normalizeWhitespace(yaml1)
    const normalized2 = normalizeWhitespace(yaml2)
    
    expect(normalized1).toBe('id: test\n')
    expect(normalized2).toBe('id: test\n')
  })

  it('preserves intentional blank lines', () => {
    const yaml = 'id: test\n\nname: value'
    const normalized = normalizeWhitespace(yaml)
    
    expect(normalized).toBe('id: test\n\nname: value\n')
  })

  it('handles consistent indentation', () => {
    const yaml = `id: test
rules:
  - id: rule-1
    severity: warn`
    
    const normalized = normalizeWhitespace(yaml)
    
    expect(normalized).toContain('  - id: rule-1')
    expect(normalized).toContain('    severity: warn')
  })
})

describe('Metadata Capture', () => {
  it('captures metadata when requested', () => {
    const markdown = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]
\`\`\`
`
    
    const blocks = [
      {
        content: `id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]`,
        startLine: 3,
        endLine: 10,
      }
    ]
    
    const result = buildIR(blocks, { captureMetadata: true, originalMarkdown: markdown })
    
    expect(result.document?._markdown_meta).toBeDefined()
    expect(result.document?._markdown_meta?.original_structure).toBe('single-block')
    expect(result.document?._markdown_meta?.header_prefix).toBe('# AlignTrue Rules')
    expect(result.document?._markdown_meta?.whitespace_style?.indent).toBe('spaces')
    expect(result.document?._markdown_meta?.whitespace_style?.indent_size).toBe(2)
    expect(result.document?._markdown_meta?.whitespace_style?.line_endings).toBe('lf')
  })

  it('detects tab indentation', () => {
    const yaml = `id: test
rules:
\t- id: rule-1
\t  severity: warn`
    
    const style = detectIndentStyle(yaml)
    
    expect(style.indent).toBe('tabs')
  })

  it('detects 4-space indentation', () => {
    const yaml = `id: test
rules:
    - id: rule-1
        severity: warn`
    
    const style = detectIndentStyle(yaml)
    
    expect(style.indent).toBe('spaces')
    expect(style.indent_size).toBe(4)
  })

  it('detects CRLF line endings', () => {
    const text = "line1\r\nline2\r\nline3\r\n"
    const endings = detectLineEndings(text)
    
    expect(endings).toBe('crlf')
  })

  it('detects LF line endings', () => {
    const text = "line1\nline2\nline3\n"
    const endings = detectLineEndings(text)
    
    expect(endings).toBe('lf')
  })

  it('extracts header prefix from markdown', () => {
    const markdown = `# My Rules

Some text here.

\`\`\`aligntrue
id: test
\`\`\``
    
    const header = extractHeaderPrefix(markdown, 5)
    
    expect(header).toBe('# My Rules')
  })
})

