import { describe, it, expect } from 'vitest'
import { generateMarkdown } from '../src/generator.js'
import type { IRDocument } from '../src/ir-builder.js'

describe('generateMarkdown', () => {
  it('generates basic markdown from IR', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [
        {
          id: 'testing.require.tests',
          severity: 'warn',
          applies_to: ['**/*.ts'],
          guidance: 'All features must have tests.'
        }
      ]
    }
    
    const markdown = generateMarkdown(ir)
    
    expect(markdown).toContain('# AlignTrue Rules')
    expect(markdown).toContain('```aligntrue')
    expect(markdown).toContain('id: test-rules')
    expect(markdown).toContain('testing.require.tests')
    expect(markdown).toContain('```')
  })

  it('uses custom header text', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: []
    }
    
    const markdown = generateMarkdown(ir, { headerText: '# My Custom Rules' })
    
    expect(markdown).toContain('# My Custom Rules')
  })

  it('preserves header from metadata', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [],
      _markdown_meta: {
        header_prefix: '## Project Rules',
        whitespace_style: {
          indent: 'spaces',
          indent_size: 2,
          line_endings: 'lf'
        }
      }
    }
    
    const markdown = generateMarkdown(ir, { preserveMetadata: true })
    
    expect(markdown).toContain('## Project Rules')
  })

  it('places guidance before block when metadata indicates', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [],
      guidance: 'This file demonstrates AlignTrue rules.',
      _markdown_meta: {
        guidance_position: 'before-block',
        whitespace_style: {
          indent: 'spaces',
          indent_size: 2,
          line_endings: 'lf'
        }
      }
    }
    
    const markdown = generateMarkdown(ir, { preserveMetadata: true })
    
    // Guidance should be before ```aligntrue block
    const guidanceIndex = markdown.indexOf('This file demonstrates')
    const blockIndex = markdown.indexOf('```aligntrue')
    
    expect(guidanceIndex).toBeGreaterThan(0)
    expect(guidanceIndex).toBeLessThan(blockIndex)
    
    // Guidance should NOT be in YAML
    const yamlStart = markdown.indexOf('```aligntrue') + '```aligntrue'.length
    const yamlEnd = markdown.lastIndexOf('```')
    const yamlContent = markdown.slice(yamlStart, yamlEnd)
    
    expect(yamlContent).not.toContain('This file demonstrates')
  })

  it('keeps guidance in doc when metadata indicates', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [],
      guidance: 'This file demonstrates AlignTrue rules.',
      _markdown_meta: {
        guidance_position: 'in-doc',
        whitespace_style: {
          indent: 'spaces',
          indent_size: 2,
          line_endings: 'lf'
        }
      }
    }
    
    const markdown = generateMarkdown(ir, { preserveMetadata: true })
    
    // Guidance should be in YAML block
    const yamlStart = markdown.indexOf('```aligntrue') + '```aligntrue'.length
    const yamlEnd = markdown.lastIndexOf('```')
    const yamlContent = markdown.slice(yamlStart, yamlEnd)
    
    expect(yamlContent).toContain('This file demonstrates')
  })

  it('uses 4-space indent when specified', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [
        {
          id: 'testing.require.tests',
          severity: 'warn',
          applies_to: ['**/*.ts']
        }
      ]
    }
    
    const markdown = generateMarkdown(ir, { indentSize: 4 })
    
    // Check that rules array uses 4-space indent (base level)
    expect(markdown).toMatch(/\n    - id: testing\.require\.tests/)
    // Note: YAML library indents nested properties by 2 additional spaces (6 total with 4-space base)
    expect(markdown).toMatch(/\n      severity: warn/)
  })

  it('uses tabs when metadata indicates', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [
        {
          id: 'testing.require.tests',
          severity: 'warn',
          applies_to: ['**/*.ts']
        }
      ],
      _markdown_meta: {
        whitespace_style: {
          indent: 'tabs',
          indent_size: 2,
          line_endings: 'lf'
        }
      }
    }
    
    const markdown = generateMarkdown(ir, { preserveMetadata: true })
    
    // Check for tab characters in YAML
    const yamlStart = markdown.indexOf('```aligntrue') + '```aligntrue'.length
    const yamlEnd = markdown.lastIndexOf('```')
    const yamlContent = markdown.slice(yamlStart, yamlEnd)
    
    expect(yamlContent).toContain('\t')
  })

  it('uses CRLF line endings when specified', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: []
    }
    
    const markdown = generateMarkdown(ir, { lineEndings: 'crlf' })
    
    expect(markdown).toContain('\r\n')
  })

  it('preserves line endings from metadata', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [],
      _markdown_meta: {
        whitespace_style: {
          indent: 'spaces',
          indent_size: 2,
          line_endings: 'crlf'
        }
      }
    }
    
    const markdown = generateMarkdown(ir, { preserveMetadata: true })
    
    expect(markdown).toContain('\r\n')
  })

  it('removes _markdown_meta from output YAML', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [],
      _markdown_meta: {
        header_prefix: '# Test',
        whitespace_style: {
          indent: 'spaces',
          indent_size: 2,
          line_endings: 'lf'
        }
      }
    }
    
    const markdown = generateMarkdown(ir, { preserveMetadata: true })
    
    // _markdown_meta should NOT appear in the YAML
    expect(markdown).not.toContain('_markdown_meta')
  })

  it('preserves vendor metadata', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: [
        {
          id: 'testing.require.tests',
          severity: 'warn',
          applies_to: ['**/*.ts'],
          vendor: {
            cursor: {
              ai_hint: 'Suggest test scaffolding',
              quick_fix: true
            }
          }
        }
      ]
    }
    
    const markdown = generateMarkdown(ir)
    
    expect(markdown).toContain('vendor:')
    expect(markdown).toContain('cursor:')
    expect(markdown).toContain('ai_hint:')
    expect(markdown).toContain('Suggest test scaffolding')
  })

  it('generates canonical format when no metadata', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: []
    }
    
    const markdown = generateMarkdown(ir)
    
    // Should use defaults: "# AlignTrue Rules", 2-space indent, LF endings
    expect(markdown).toContain('# AlignTrue Rules')
    expect(markdown).not.toContain('\r\n')
    expect(markdown).not.toContain('\t')
  })

  it('handles source_format field correctly', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      source_format: 'markdown',
      rules: []
    }
    
    const markdown = generateMarkdown(ir)
    
    // source_format should be preserved in YAML
    expect(markdown).toContain('source_format: markdown')
  })

  it('ends with single newline', () => {
    const ir: IRDocument = {
      id: 'test-rules',
      version: '1.0.0',
      spec_version: '1',
      rules: []
    }
    
    const markdown = generateMarkdown(ir)
    
    expect(markdown.endsWith('\n')).toBe(true)
    expect(markdown.endsWith('\n\n')).toBe(false)
  })
})

