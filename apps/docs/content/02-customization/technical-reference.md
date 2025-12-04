---
title: Technical reference
description: Technical details for implementing and working with AlignTrue customization features
---

# Customization technical reference

This page provides technical implementation details for working with plugs, overlays, and scopes. Author rules in `.aligntrue/rules/*.md`; exports (for example, `AGENTS.md`, `.cursor/rules/*.mdc`) are generated outputs and should be treated as read-only. For user-facing guides, see [Plugs](/docs/02-customization/plugs), [Overlays](/docs/02-customization/overlays), and [Scopes](/docs/02-customization/scopes).

## Where to declare features

| Feature     | Align Files  | Config File | Primary Use               |
| ----------- | ------------ | ----------- | ------------------------- |
| Plugs slots | ✓            | -           | Define template variables |
| Plugs fills | ✓ (defaults) | ✓ (project) | Fill template variables   |
| Overlays    | -            | ✓           | Override rule properties  |
| Scopes      | -            | ✓           | Filter rules by path      |

**Plugs slots:**

- Declared in align files (natural markdown sections or `.aligntrue/rules` IR)
- Example: `examples/aligns/testing.md` with natural markdown sections

**Plugs fills:**

- Declared in `.aligntrue/config.yaml` (project-level fills)
- OR in align files as stack-level defaults

**Overlays:**

- Declared in `.aligntrue/config.yaml` only (under `overlays.overrides:`)
- Applied at sync time before export

**Scopes:**

- Declared in `.aligntrue/config.yaml` only (under `scopes:`)
- Applied at load time before plugs/overlays

## Authoring formats

AlignTrue supports two authoring formats (source of truth is `.aligntrue/rules/*.md`):

### Natural markdown sections (recommended for aligns)

```markdown
---
id: testing-align
version: 1.0.0
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "pytest -q"
---

# Testing align

Use consistent test commands across your project.

## Testing guidelines

Run tests before committing: [[plug:test.cmd]]
```

### Direct YAML (internal IR format)

AlignTrue keeps an internal IR in memory while syncing; this YAML shows the equivalent shape for reference. Your authored files stay in `.aligntrue/rules/*.md`.

```yaml
id: testing-align
version: 1.0.0
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
rules:
  - id: testing.run-tests
    severity: error
    guidance: "Run tests: [[plug:test.cmd]]"
```

### Data flow

```
.aligntrue/rules/*.md → Parser → In-memory IR → Exporters → Agent exports (AGENTS.md, .cursor/rules/*.mdc, etc.)
```

**Note:** Agent exports (including `AGENTS.md` and `.cursor/rules/*.mdc`) are generated outputs. Edit `.aligntrue/rules/*.md` or `.aligntrue/config.yaml` instead.

## Plugs resolution algorithm

1. Normalize CRLF/CR to LF in rule text
2. Protect escapes: sentinel-replace `[[\plug:` temporarily
3. For each `[[plug:<key>]]`:
   - If fill exists → replace with fill value
   - If required and no fill → insert TODO block
   - If optional and no fill → replace with empty string
4. Unescape sentinel back to `[[plug:` for `[[\plug:...]`
5. Ensure single trailing LF

### TODO Block Format (Exact Bytes, LF Only)

With example:

```
TODO(plug:<key>): Provide a value for this plug.
Examples: <example-from-slot>
```

Without example:

```
TODO(plug:<key>): Provide a value for this plug.
```

### Merge order

Base < stack align(s) < repo. Last writer wins.

## Plugs format types

- `command` - Single-line command, no env vars except `CI=true`
- `text` - Any single-line UTF-8 string
- `file` - Repo-relative POSIX path, no `..` segments, no absolute paths
- `url` - Must start with `http://` or `https://`

## Plugs key naming rules

- Pattern: `^[a-z0-9._-]+$`
- Cannot start with `stack.` or `sys.` (reserved)
- Use dots for namespacing: `test.cmd`, `docs.url`, `author.name`

## Overlays selector syntax

- By rule ID: `rule[id=no-console-log]`
- By property path: `profile.version`
- By array index: `rules[0]` (less common, prefer ID)

## Overlays operations

### Set operation (supports dot notation)

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Simple property
        "check.inputs.maxLength": 120 # Nested property
        autofix: false # Disable autofix
```

### Remove operation

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      remove:
        - "autofix"
        - "tags"
```

### Combined

```yaml
overlays:
  overrides:
    - selector: "rule[id=line-length]"
      set:
        severity: "warning"
        "check.inputs.threshold": 120
      remove:
        - "autofix"
```

### Severity values

`"off"`, `"info"`, `"warning"`, `"error"`

### Application order

Overlays apply in definition order. Last matching overlay wins if multiple target same rule.

## Scopes path rules

- Must be relative (no leading `/`)
- No parent directory traversal (`..` not allowed)
- Use forward slashes (POSIX-style)
- Use `.` for workspace root

## Scopes include/exclude

- Standard glob syntax (micromatch)
- Relative to scope path
- Multiple patterns allowed
- Exclude applied after include

## Scopes merge order (default)

```yaml
merge:
  strategy: "deep"
  order: ["root", "path", "local"]
```

1. **root** - Rules from workspace root config
2. **path** - Rules from scope-specific configs
3. **local** - Rules from nested/local configs

Last writer wins for conflicts.

## Integration and order

When using multiple customization features together, they apply in this order:

1. **Scopes** - Filter rules by path
2. **Plugs** - Resolve template slots
3. **Overlays** - Apply property overrides

## Determinism and hashing

### Plugs

- **Lock hash** - Computed over canonicalized YAML **pre-resolution**
- **Export hash** - Computed over fully resolved text **post-resolution**
- Fills are **not** volatile - they affect export hash

### Overlays

- **base_hash** - Upstream content
- **overlay_hash** - Local modifications
- **result_hash** - Combined result
- Tracked in lockfile for drift detection

### Scopes

- Applied at load time before plugs and overlays
- Merge order is deterministic
- Path validation prevents security issues

## Validation rules

### Plugs

- Every `[[plug:...]]` must have declared slot
- Fills must be non-empty, single-line scalars
- Keys cannot start with `stack.` or `sys.`
- Format validation (command, text, file, url)
- Required slots must have fills or render TODO blocks

### Overlays

- Selectors must match existing rules
- Severity values must be valid (`off`, `info`, `warning`, `error`)
- Property paths use dot notation for nested properties
- Remove operations list property names to delete
- Stale selectors (no match) flagged in `override status`

### Scopes

- Paths must be relative (no leading `/`)
- No parent directory traversal (`..`)
- Glob patterns must be syntactically valid
- Merge order values must be `root`, `path`, or `local`
- No duplicate values in merge order
- Rulesets must reference existing rule align IDs

## Best practices

### For plugs

1. Provide examples for required slots
2. Use most restrictive format (command > file > text)
3. Mark as optional unless truly required
4. Namespace keys with dots: `test.cmd`, `docs.url`
5. Never put secrets in fills (use env vars at runtime)

### For overlays

1. Keep overlays minimal (fewer = easier updates)
2. Document reasons with YAML comments
3. Track expiration dates for temporary overrides
4. Review regularly with `override status`
5. Consolidate duplicate overlays

### For scopes

1. Start simple, add complexity only when needed
2. Use shared base rules across all scopes
3. Map scopes to team ownership boundaries
4. Exclude test files if rules differ
5. Document scope ownership with comments

## Vendor bags (passive)

Vendor bags are an implementation detail that preserves agent-specific metadata during sync. You don't need to configure or manage them - they work automatically.

**What they do:**

- Preserve Cursor-specific fields when importing from `.mdc` files
- Store agent metadata in `vendor.<agent>.*` namespace
- Exclude volatile fields (like session IDs) from hashing
- Enable lossless round-trips between IR and agent formats

**When they matter:**

- Preserving agent-specific fields when importing from agent formats
- Importing from agent-specific formats
- Preserving agent hints and metadata

You don't need to understand vendor bags to use AlignTrue effectively - they're implementation details for the system.

## CLI Workflows

### Plugs workflow

```bash
# 1. Audit slots and fills
aligntrue plugs list

# 2. Set required fills
aligntrue plugs set test.cmd "pnpm test"

# 3. Preview resolution
aligntrue plugs resolve

# 4. Sync to agents
aligntrue sync
```

### Overlays workflow

```bash
# 1. Add overlay
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error

# 2. View all overlays
aligntrue override status

# 3. Show effects
aligntrue override diff

# 4. Sync to agents
aligntrue sync
```

### Scopes workflow

```bash
# 1. Configure scopes in .aligntrue/config.yaml
aligntrue scopes

# 2. Validate
aligntrue check

# 3. Sync to agents
aligntrue sync
```

## Related documentation

- [Plugs Guide](/docs/02-customization/plugs)
- [Overlays Guide](/docs/02-customization/overlays)
- [Scopes Guide](/docs/02-customization/scopes)
- [CLI Reference](/docs/04-reference/cli-reference)
- [Solo Developer Guide](/docs/01-guides/01-solo-developer-guide)
- [Team Guide](/docs/01-guides/02-team-guide)
