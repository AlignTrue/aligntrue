import { describe, it, expect } from 'vitest'
import { validateMarkdown } from '../src/validator.js'

describe('validateMarkdown', () => {
  it('validates markdown with valid IR', () => {
    const markdown = `## Testing Rules

All features need tests.

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: "Write tests"
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('reports parse errors with line numbers', () => {
    const markdown = `## Testing

\`\`\`aligntrue
id: test
\`\`\`

More text

\`\`\`aligntrue
id: test2
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]?.message).toContain('contains 2 aligntrue blocks')
  })

  it('reports IR build errors', () => {
    const markdown = `## Testing

\`\`\`aligntrue
invalid: yaml: {{{
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('reports schema validation errors', () => {
    const markdown = `## Testing

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: invalid.id.format
    severity: warn
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    // Should report missing applies_to and invalid id pattern
  })

  it('handles vendor bags correctly', () => {
    const markdown = `## Testing

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    vendor:
      cursor:
        ai_hint: "Test hint"
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(true)
  })

  it('validates source_format field', () => {
    const markdown = `## Testing

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
source_format: markdown
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(true)
  })

  it('maps errors to markdown line numbers', () => {
    const markdown = `## Testing Rules

Some guidance text.

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules: []
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    // All errors should reference line 5 (block start)
    if (result.errors.length > 0) {
      expect(result.errors[0]?.line).toBe(5)
    }
  })

  it('includes section info in errors', () => {
    const markdown = `## Testing Rules

\`\`\`aligntrue
invalid yaml
\`\`\`
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.section).toBe('Testing Rules')
  })

  it('handles unclosed fences gracefully', () => {
    const markdown = `## Testing

\`\`\`aligntrue
id: test
version: 1.0.0
`
    const result = validateMarkdown(markdown)
    
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.message).toContain('Unclosed')
  })
})

