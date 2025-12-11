---
title: "Natural markdown sections"
description: "Write rules as natural markdown with headings and content. Learn section format, fingerprints, change detection, and lockfile integration."
---

# Natural markdown sections

Learn how to write rules as natural markdown sections without explicit rule IDs or metadata.

## Overview

Natural markdown lets you write rules as readable markdown sections instead of structured YAML rules. AlignTrue automatically converts section headings and content into rule-like structures with fingerprints.

**Benefits:**

- Write guidance as natural prose
- No explicit rule IDs to manage
- Heading text becomes the rule topic
- Markdown structure is automatically fingerprinted for change detection
- Easier for AI agents to read and understand

## Quick start

1. Initialize AlignTrue (solo mode by default):

   ```bash
   aligntrue init
   ```

2. Create `.aligntrue/rules/my-rules.md` with a minimal frontmatter header:

   ```markdown
   ---
   id: aligns/example/my-rules
   version: 1.0.0
   summary: Natural markdown example
   tags: [example]
   ---

   # My project rules

   ## Testing requirements

   Run unit tests and linters before merging.
   ```

3. Add `##` sections for each rule.
4. Validate locally:

   ```bash
   aligntrue check
   ```

5. Export to configured agents:

   ```bash
   aligntrue sync
   ```

## Section format

Use level 2 headings (`##`) for primary rules. Level 3+ headings are also extracted as **independent** sections (nested for structure only) and receive their own fingerprints, so keep nesting intentional:

```markdown
---
id: "aligns/example/my-rules"
version: "1.0.0"
summary: "Example rules using natural markdown sections"
tags: ["example", "sections"]
---

# My project rules

This align establishes our project standards.

## Testing requirements

Write comprehensive tests for all features. Aim for unit tests covering the happy path, error cases, and edge conditions. Use the test pyramid: more unit tests, fewer integration tests, minimal e2e.

- Minimum 80% code coverage
- Use descriptive test names
- Keep tests deterministic and fast

## Performance standards

Optimize for user-perceived performance. Profile before optimizing. Keep API responses under 200ms for user-facing operations.

- Monitor Core Web Vitals
- Cache aggressively for static content
- Use CDN for global distribution

## Security baseline

Never commit secrets to version control. Use environment variables or a secrets manager for runtime configuration.

- Scan for secrets in CI
- Rotate credentials regularly
- Review third-party dependencies
```

Each heading from `##` to `######` becomes a rule-like section with:

- **Fingerprint** - Generated from heading + content (or an explicit ID)
- **Heading** - Section heading (e.g., "Testing Requirements")
- **Content** - Markdown content under the heading **until the next heading at any depth**
- **Level** - Heading level (typically 2 for rules)

Notes:

- Content above the first heading is treated as a preamble and not exported as a section.
- Parent sections stop collecting content when the first child heading appears; child sections become separate entries with their own fingerprints.
- Headings inside fenced code blocks are ignored (they stay in the surrounding section’s content).

## Frontmatter

Frontmatter is optional but recommended. If omitted, AlignTrue defaults to `id: unnamed-align` and `version: 1.0.0`.

```yaml
---
id: "aligns/namespace/align-id"
version: "1.0.0"
summary: "One-line description of the align"
tags: ["tag1", "tag2"]
---
```

**Supported fields:**

- `id` - Align identifier (recommend set explicitly; required in team mode)
- `version` - Semantic version (defaults to `1.0.0` if omitted)
- `summary` - Brief description (required in team/catalog modes)
- `tags` - Optional tags (lowercase, kebab-case)
- `owner` - Required in team/catalog modes
- `source` - Required in team/catalog modes (e.g., repo URL)
- `source_sha` - Required in team/catalog modes (git SHA or content hash)

`spec_version` is added automatically by the CLI. `license`/`author` fields are not read by the natural markdown parser today.

## Fingerprints

- Format: `{kebab-heading}-{6-char-hash}` where:
  - Heading is lowercased, non-alphanumerics replaced with `-`, trimmed, and capped at 50 chars.
  - Hash uses normalized content with whitespace collapsed.
- Fingerprints change when heading **or content** changes; whitespace-only edits usually keep the same hash.
- Add an explicit ID comment to pin the fingerprint across edits (lowercase letters, numbers, `.`, `-`):

  ```markdown
  ## Testing requirements

  Run tests. <!-- aligntrue-id: testing.requirements -->
  ```

- Duplicate headings produce warnings at the first occurrence; make them unique or add explicit IDs.

## Change detection

AlignTrue tracks section fingerprints and content hashes to detect:

- **Modified** - Fingerprint matches lockfile but content hash differs.
- **New** - Fingerprint not present in lockfile.
- **Deleted** - Fingerprint present in lockfile but missing in current document.

See [Lockfile](#lockfile-integration) for how changes are recorded.

## Lockfile integration

In team mode, lockfile entries use section fingerprints:

```json
{
  "version": "1",
  "generated_at": "2024-01-01T00:00:00.000Z",
  "mode": "team",
  "rules": [
    {
      "rule_id": "testing-requirements-5d8e9c",
      "content_hash": "sha256:abc123..."
    }
  ],
  "bundle_hash": "sha256:def456..."
}
```

Lockfile notes:

- `rule_id` comes from the section fingerprint (or explicit ID comment).
- `content_hash` is derived from the section content; rules are sorted by `rule_id` for determinism.
- `bundle_hash` is computed from the sorted rule hashes.

## Writing guidelines

### Be clear and actionable

Write sections as guidance that agents can understand:

```markdown
## Code quality standards

Enforce consistent code style through linting. Run prettier on save and eslint in CI.
Fix all issues before merging.

- Use ESLint with `@typescript-eslint` plugins
- Format with Prettier (2-space indentation)
- No manual formatting allowed
```

### Include examples

Show concrete examples when helpful:

```markdown
## Commit message format

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

### Section hierarchy

Use H2 (`##`) for primary rules. H3+ headings are captured as separate sections under the preceding H2. Parent content ends before the first child heading, so put shared guidance above child headings.

```markdown
# Title

Intro text

## Security

Baseline rules.

### Input validation

Never trust user input.
```

## Advanced examples

### Multi-section Align

Create Aligns with many sections organized hierarchically:

```markdown
---
id: "aligns/my-org/comprehensive"
version: "1.0.0"
summary: "Comprehensive coding standards"
tags: ["standards", "comprehensive"]
---

# Comprehensive standards

## Code style

Guidelines for code formatting and naming.

### TypeScript

Use strict TypeScript. Enable all strict compiler flags.

### Python

Follow PEP 8 with 4-space indentation.

## Testing

Comprehensive testing requirements.

### Unit tests

Fast, focused tests of individual units.

### Integration tests

Test boundaries between components.

## Documentation

Clear, maintained documentation.

### Inline comments

When code intent is unclear, add comments.

### README

Every project needs a README with quickstart.
```

Each `##` heading becomes a separate rule:

- `Code style`
- `Testing`
- `Documentation`

Each `###` heading becomes its own section under the prior `##`; parent content does **not** automatically include child sections.

### Included example Aligns

Example Aligns in `examples/aligns/` demonstrate natural markdown:

- `global.md` - Base global rules
- `testing.md` - Testing standards
- `typescript.md` - TypeScript guidelines
- `security.md` - Security baseline
- `docs.md` - Documentation standards

## Backward compatibility

Natural markdown sections coexist with rule-based Aligns:

**Rule-based Align (legacy):**

```yaml
id: my-rules
version: 1.0.0
rules:
  - id: rule.one
    severity: error
    guidance: Text here
```

**Section-based Align (natural markdown):**

```markdown
# My rules

## Rule one

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
- Work best for guidance-focused Aligns

For complex rule definitions with machine-checkable conditions, use rule-based YAML format.

## Related pages

- [Getting Started](/docs/00-getting-started/00-quickstart) - Quick start guide
- [Example Aligns](/docs/04-reference/examples) - Curated example Aligns
