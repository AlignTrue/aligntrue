# Markdown authoring guide

Learn how to author AlignTrue rules in markdown format.

{/_ prettier-ignore-start _/}
<Callout type="info">
**Looking for the recommended format?** See the [Natural Markdown Workflow guide](/docs/01-guides/natural-markdown-workflow) for the modern, streamlined approach using YAML frontmatter and section headings.

This guide documents the **legacy fenced block format** which is still fully supported for backward compatibility.
</Callout>
{/_ prettier-ignore-end _/}

## Overview

AlignTrue supports two markdown authoring formats:

1. **Natural Markdown (Recommended)** - YAML frontmatter + section headings (`##`). No fenced blocks required.
2. **Legacy Fenced Blocks** - Markdown with ` ```aligntrue` fenced code blocks containing YAML (documented here)

**For new projects, we recommend natural markdown.** It's simpler, more readable, and easier for AI agents to understand.

## When to use fenced blocks

The legacy fenced block format is useful when:

- You need to maintain existing packs that use this format
- You're working with tools that expect literate markdown
- You want explicit YAML rule definitions with machine-checkable fields

For most use cases, [natural markdown](/docs/01-guides/natural-markdown-workflow) is simpler and more maintainable.

## Literate markdown format (legacy)

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

## File structure

**One block per file** - Each literate markdown file should contain ONE fenced ` ```aligntrue` block:

````markdown
# My Project Rules

This file defines all project rules.

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules: [...]
```

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
```

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

### Testing requirements

````markdown
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
```
````

## Migrating to natural markdown

To convert from fenced blocks to natural markdown:

1. **Extract metadata to frontmatter:**

````markdown
# Before (fenced blocks)

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
```
````

# After (natural markdown)

---

id: "my-rules"
version: "1.0.0"
spec_version: "1"

---

````

2. **Convert rules to sections:**

```markdown
# Before (fenced blocks)
rules:
  - id: code.quality
    guidance: Write clean code...

# After (natural markdown)
## Code Quality

Write clean code...
````

3. **Manual migration:**

Copy your existing rules from agent files and paste into `AGENTS.md`:

```bash
# After copying rules to AGENTS.md
aligntrue sync
# Syncs to all configured agents
```

See the [Quickstart](/docs/00-getting-started/00-quickstart) to get started with AlignTrue.

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
```

**"Missing required field"**

All rules require:

- `id` - Unique rule identifier
- `severity` - ERROR, WARN, or INFO
- `applies_to` - File glob patterns
- `guidance` - Description text

See the IR format reference for complete schema.

## Related pages

- [Natural Markdown Workflow](/docs/01-guides/natural-markdown-workflow) - Recommended modern format
- [Natural Markdown Sections](/docs/04-reference/natural-markdown-sections) - Technical reference
- [Sync Behavior](/docs/03-concepts/sync-behavior) - How rules flow to agents
- [CLI Reference - md commands](/docs/04-reference/cli-reference/development#aligntrue-md-lint) - md lint, compile, format
