# Markdown authoring guide

Learn how to author rules in literate markdown format using fenced code blocks.

## Overview

AlignTrue supports two markdown formats:

- **Literate markdown** - Author your own rules using fenced ```aligntrue blocks
- **Generated exports** - Files created by AlignTrue using HTML comment markers

This guide covers **literate markdown authoring**. For generated exports, see the sync behavior documentation.

## Literate markdown format

Use fenced code blocks with the `aligntrue` language tag to define rules:

````markdown
# My Project Rules

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: style.naming
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Use camelCase for function names

  - id: testing.required
    severity: warn
    applies_to: ["src/**/*.ts"]
    guidance: Write tests for new functions
```
````

````

## File structure

**One block per file** - Each literate markdown file should contain ONE fenced ```aligntrue block:

```markdown
# My Project Rules

This file defines all project rules.

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules: [...]
````

Additional markdown content below (optional).

````

## Validation

Use the markdown commands to validate your authored rules:

```bash
# Lint your markdown
aligntrue md lint my-rules.md

# Format your markdown
aligntrue md format my-rules.md

# Compile to IR (Intermediate Representation)
aligntrue md compile my-rules.md
````

## Round-trip workflow

For authoring in pure YAML format, round-trip between markdown and YAML:

```bash
# Start with YAML
echo 'id: my-rules
version: 1.0.0
spec_version: "1"
rules: []' > rules.yaml

# Generate markdown from YAML
aligntrue md generate rules.yaml --output AGENTS.md --header "# My Rules"

# Edit generated markdown...

# Compile back to YAML
aligntrue md compile AGENTS.md --output rules.yaml
```

## Integration with sync

Once you've authored rules in literate markdown:

```bash
# 1. Compile to IR (internal format)
aligntrue md compile my-rules.md

# 2. Sync to agents
aligntrue sync
```

## Common patterns

### Project standards

````markdown
# Project Standards

```aligntrue
id: acme-standards
version: 1.0.0
spec_version: "1"
rules:
  - id: code.typescript.strict
    severity: error
    applies_to: ["**/*.ts", "**/*.tsx"]
    guidance: |
      Enable strict TypeScript compilation.
      Set these in tsconfig.json:
      - noImplicitAny: true
      - strictNullChecks: true
```
````

````

### Testing requirements

```markdown
# Testing Guide

```aligntrue
id: testing-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: tests.unit.required
    severity: warn
    applies_to: ["src/**/*.ts"]
    guidance: Write unit tests in `*.test.ts` files

  - id: tests.coverage
    severity: info
    applies_to: ["src/**"]
    guidance: Aim for >80% code coverage
````

````

## Troubleshooting

**"No aligntrue blocks found"**

Ensure:
- The block uses exactly ` ```aligntrue` (with language tag)
- Only ONE block per file
- YAML content is valid

**"Invalid YAML"**

Use a YAML linter to validate:
```bash
aligntrue md lint my-rules.md
````

**"Missing required field"**

All rules require:

- `id` - Unique rule identifier
- `severity` - ERROR, WARN, or INFO
- `applies_to` - File glob patterns
- `guidance` - Description text

See the IR format reference for complete schema.

## Related pages

- [Sync Behavior](/docs/03-concepts/sync-behavior) - IR format and how rules flow to agents
- [CLI Reference - md commands](/docs/04-reference/cli-reference/development#aligntrue-md-lint) - md lint, compile, format
