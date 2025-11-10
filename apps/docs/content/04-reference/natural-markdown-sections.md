# Natural Markdown Sections

Learn how to write rules as natural markdown sections without explicit rule IDs or metadata.

## Overview

Natural markdown lets you write rules as readable markdown sections instead of structured YAML rules. AlignTrue automatically converts section headings and content into rule-like structures with fingerprints.

**Benefits:**

- Write guidance as natural prose
- No explicit rule IDs to manage
- Heading text becomes the rule topic
- Markdown structure is automatically fingerprinted for change detection
- Easier for AI agents to read and understand

## Section Format

Write sections with level 2 headings (`##`):

```markdown
---
id: "packs/example/my-rules"
version: "1.0.0"
summary: "Example rules using natural markdown sections"
tags: ["example", "sections"]
---

# My Project Rules

This pack establishes our project standards.

## Testing Requirements

Write comprehensive tests for all features. Aim for unit tests covering the happy path, error cases, and edge conditions. Use the test pyramid: more unit tests, fewer integration tests, minimal e2e.

- Minimum 80% code coverage
- Use descriptive test names
- Keep tests deterministic and fast

## Performance Standards

Optimize for user-perceived performance. Profile before optimizing. Keep API responses under 200ms for user-facing operations.

- Monitor Core Web Vitals
- Cache aggressively for static content
- Use CDN for global distribution

## Security Baseline

Never commit secrets to version control. Use environment variables or a secrets manager for runtime configuration.

- Scan for secrets in CI
- Rotate credentials regularly
- Review third-party dependencies
```

Each section becomes a rule with:

- **Fingerprint** - Stable identifier based on heading and position
- **Heading** - Section heading (e.g., "Testing Requirements")
- **Content** - Full markdown content under the heading
- **Level** - Heading level (typically 2 for rules)

## Frontmatter

All natural markdown files must include YAML frontmatter:

```yaml
---
id: "packs/namespace/pack-id"
version: "1.0.0"
summary: "One-line description of the pack"
tags: ["tag1", "tag2"]
---
```

**Required fields:**

- `id` - Pack identifier (e.g., `packs/base/base-testing`)
- `version` - Semantic version
- `summary` - Brief description
- `tags` - Search tags

**Optional fields:**

- `author` - Pack author name
- `license` - License identifier (default: CC0-1.0)

## Fingerprints

Each section gets a stable fingerprint based on:

1. Heading text (normalized)
2. Position in document
3. Parent section context

**Example fingerprints:**

- `fp:testing-requirements-5d8e` - "Testing Requirements" section
- `fp:performance-standards-7a2c` - "Performance Standards" section

Fingerprints remain stable when:

- Content changes
- New sections are added before/after
- Order of content lines changes

Fingerprints change when:

- Heading text is renamed
- Section is moved to different level

## Change Detection

AlignTrue detects three types of changes:

**Modified sections:**

```
hash mismatch - content changed since last sync
```

**New sections:**

```
section added - not in previous lockfile
```

**Deleted sections:**

```
section removed - in lockfile but not in current document
```

See [Lockfile](#lockfile-integration) for how changes are tracked.

## Lockfile Integration

In team mode, lockfile entries use section fingerprints:

```json
{
  "rules": [
    {
      "rule_id": "fp:testing-requirements-5d8e",
      "content_hash": "sha256:abc123...",
      "source": "https://github.com/org/repo"
    }
  ],
  "bundle_hash": "sha256:def456..."
}
```

Changes are detected by comparing content hashes:

- **Same hash** - Section unchanged
- **Different hash** - Section modified
- **Missing hash** - Section was deleted
- **New hash** - Section was added

## Writing Guidelines

### Be Clear and Actionable

Write sections as guidance that agents can understand:

```markdown
## Code Quality Standards

Enforce consistent code style through linting. Run prettier on save and eslint in CI.
Fix all issues before merging.

- Use ESLint with `@typescript-eslint` plugins
- Format with Prettier (2-space indentation)
- No manual formatting allowed
```

### Include Examples

Show concrete examples when helpful:

```markdown
## Commit Message Format

Use conventional commits format:
```

type(scope): description

- type: feat, fix, docs, style, refactor, test, chore
- scope: optional, affected module
- description: lowercase, imperative mood
- body: optional, wrap at 72 characters

Example:
feat(auth): add two-factor authentication

- Integrate TOTP support
- Update user settings UI
- Add recovery codes

```

```

### Section Hierarchy

Use H2 (`##`) for main sections (becomes rules):

```markdown
# Title

Introduction

## Main Section 1

Content

## Main Section 2

Content
```

Use H3 (`###`) for subsections (part of parent section content):

```markdown
## Security

All code must follow security best practices.

### Input Validation

Never trust user input. Validate all inputs...

### Error Handling

Never expose internal errors to users...
```

## Example Packs

Example packs in `examples/packs/` demonstrate natural markdown:

- `global.md` - Base global rules
- `testing.md` - Testing standards
- `typescript.md` - TypeScript guidelines
- `security.md` - Security baseline
- `docs.md` - Documentation standards

## Backward Compatibility

Natural markdown sections coexist with rule-based packs:

**Rule-based pack (legacy):**

```yaml
id: my-rules
version: 1.0.0
rules:
  - id: rule.one
    severity: error
    guidance: Text here
```

**Section-based pack (natural markdown):**

```markdown
# My Rules

## Rule One

Text here
```

Both formats work in the same project. AlignTrue detects the format automatically.

## Migration

To convert from rule-based to section-based:

1. **Export current rules** - Run `aligntrue export`
2. **Create markdown** - Write natural sections
3. **Update config** - Point to new markdown file
4. **Run sync** - AlignTrue will detect the change
5. **Verify** - Check that all sections are recognized

See the [Quickstart](/docs/00-getting-started/00-quickstart) for setup instructions.

## Limitations

Natural markdown sections:

- Cannot express complex rule metadata (checks, autofixes)
- Are simpler than rule-based format
- Work best for guidance-focused packs

For complex rule definitions with machine-checkable conditions, use rule-based format with fenced blocks.

## Related Pages

- [Markdown Authoring](/docs/04-reference/markdown-authoring) - Fenced code block format
- [Getting Started](/docs/00-getting-started/00-quickstart) - Quick start guide
- [Example Packs](/docs/04-reference/examples) - Curated example packs
