# @aligntrue/markdown-parser

Literate markdown parser for AlignTrue rules. Extract and validate fenced ```aligntrue blocks from markdown files.

## Features

- **Fenced block extraction**: Parse markdown files to extract ```aligntrue blocks
- **One block per section**: Enforces single aligntrue block per markdown section
- **Guidance preservation**: Captures prose before blocks as contextual guidance
- **IR conversion**: Converts markdown blocks to canonical intermediate representation
- **Whitespace normalization**: Consistent formatting before hashing
- **Schema validation**: Validates IR against AlignTrue v1 schema

## Installation

```bash
pnpm add @aligntrue/markdown-parser
```

## Usage

### Parse Markdown

```typescript
import { parseMarkdown } from '@aligntrue/markdown-parser'

const markdown = `## Testing Rules

All features must have tests.

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: require-tests
    severity: warn
    applies_to: ["**/*.ts"]
\`\`\`
`

const result = parseMarkdown(markdown)

if (result.errors.length === 0) {
  console.log(`Found ${result.blocks.length} blocks`)
  console.log(`Guidance: ${result.blocks[0].guidanceBefore}`)
}
```

### Build IR Document

```typescript
import { parseMarkdown, buildIR } from '@aligntrue/markdown-parser'

const markdown = `...` // your markdown content
const parseResult = parseMarkdown(markdown)
const irResult = buildIR(parseResult.blocks)

if (irResult.document) {
  console.log(`Built IR document: ${irResult.document.id}`)
  console.log(`Source format: ${irResult.document.source_format}`) // 'markdown'
}
```

### Validate Markdown

```typescript
import { validateMarkdown } from '@aligntrue/markdown-parser'

const markdown = `...` // your markdown content
const result = validateMarkdown(markdown)

if (result.valid) {
  console.log('✓ Valid')
} else {
  result.errors.forEach(err => {
    console.error(`Line ${err.line}: ${err.message}`)
  })
}
```

## Fenced Block Format

AlignTrue uses standard markdown fenced code blocks with the `aligntrue` language tag:

````markdown
## Section Title

Optional guidance prose before the block.
This text will be captured as `guidanceBefore`.

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: my-rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: "Rule-specific guidance"
```
````

### Rules

1. **One block per section**: Each markdown section (marked by `#` headers) can contain at most one ```aligntrue block
2. **YAML content**: Block content must be valid YAML that conforms to AlignTrue IR schema
3. **Guidance extraction**: Prose text between the section header and the fenced block is captured as guidance context
4. **Section titles**: The most recent markdown header (any level) becomes the section title for that block

## Whitespace Normalization

The parser normalizes whitespace in YAML blocks:

- Converts tabs to 2 spaces
- Removes trailing whitespace from lines
- Ensures single newline at EOF
- Preserves intentional blank lines

This ensures deterministic hashing and consistent formatting.

## API

### `parseMarkdown(markdown: string): ParseResult`

Extract fenced ```aligntrue blocks from markdown.

Returns:
```typescript
interface ParseResult {
  blocks: FencedBlock[]
  errors: Array<{ line: number; message: string }>
}

interface FencedBlock {
  content: string          // YAML content
  startLine: number        // Line number where block starts
  endLine: number          // Line number where block ends
  sectionTitle?: string    // Title from preceding header
  guidanceBefore?: string  // Prose before block
}
```

### `buildIR(blocks: FencedBlock[]): IRBuildResult`

Convert parsed blocks to IR document.

Returns:
```typescript
interface IRBuildResult {
  document?: IRDocument
  errors: IRBuildError[]
}

interface IRDocument {
  id: string
  version: string
  spec_version: string
  rules: unknown[]
  source_format?: 'markdown' | 'yaml'
}
```

### `validateMarkdown(markdown: string): MarkdownValidationResult`

Parse, build IR, and validate against schema in one step.

Returns:
```typescript
interface MarkdownValidationResult {
  valid: boolean
  errors: MarkdownValidationError[]
}

interface MarkdownValidationError {
  line: number
  section?: string
  field?: string
  message: string
}
```

### `normalizeWhitespace(yaml: string): string`

Normalize whitespace in YAML content.

## Error Handling

All errors include line numbers and clear messages:

```typescript
const result = validateMarkdown(markdown)

result.errors.forEach(err => {
  const location = err.section 
    ? `Line ${err.line} (${err.section})`
    : `Line ${err.line}`
  console.error(`${location}: ${err.message}`)
})
```

## CLI Usage

The `@aligntrue/cli` package provides markdown commands:

```bash
# Validate markdown file
aligntrue md lint rules.md

# Format markdown blocks (normalize whitespace)
aligntrue md format rules.md

# Compile markdown to YAML
aligntrue md compile rules.md --output aligntrue.yaml
```

## License

MIT
