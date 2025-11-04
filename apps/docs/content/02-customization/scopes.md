---
title: Scopes
description: Path-based rule application for monorepos with hierarchical merge order
---

# Scopes guide

Scopes enable path-based rule application for monorepos. Apply different rules to frontend vs backend, new code vs legacy, or team-specific directories while maintaining a shared base.

> **See it in action:** Check out the [monorepo scopes example](https://github.com/AlignTrue/aligntrue/tree/main/examples/monorepo-scopes) for a working demonstration.

## Quick example

**Monorepo structure:**

```
my-monorepo/
├── apps/
│   ├── web/          # Next.js app
│   └── mobile/       # React Native app
├── packages/
│   └── api/          # Node.js API
└── services/
    └── worker/       # Python worker
```

**Scope configuration:**

```yaml
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]

  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base-rules", "node-rules"]

  - path: "services/worker"
    include: ["**/*.py"]
    rulesets: ["base-rules", "python-rules"]
```

**Result:** Each directory gets appropriate stack-specific rules.

## When to use scopes

### Good use cases

- **Monorepos** - Different tech stacks per directory
- **Team boundaries** - Team A owns `apps/web`, Team B owns `packages/api`
- **Progressive adoption** - Strict rules in new code, lenient in legacy
- **Multi-stack projects** - Frontend + backend + services with different requirements

### Not suitable for

- **Single-stack projects** - Use base rules without scopes
- **Rule customization** - Use overlays to adjust severity/inputs
- **Stack-specific values** - Use plugs for test commands, paths, etc.

## Scope anatomy

### Basic scope

```yaml
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]
```

### Advanced scope with exclusions

```yaml
scopes:
  - path: "packages/api"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts", "**/__tests__/**"]
    rulesets: ["base-rules", "node-rules", "api-rules"]
```

### Default scope (workspace root)

```yaml
scopes:
  - path: "." # Workspace root
    include: ["**/*.ts"]
    rulesets: ["base-rules"]
```

## Scope properties

### path (required)

Relative path from workspace root.

**Rules:**

- Must be relative (no leading `/`)
- No parent directory traversal (`..` not allowed)
- Use forward slashes (POSIX-style)
- Use `.` for workspace root

**Examples:**

```yaml
# Valid
path: "apps/web"
path: "packages/api"
path: "."  # Workspace root

# Invalid
path: "/apps/web"  # Absolute path
path: "../other"   # Parent traversal
path: "apps\\web"  # Backslashes (use forward slashes)
```

### include (optional)

Glob patterns to include files.

**Rules:**

- Standard glob syntax (micromatch)
- Relative to scope path
- Multiple patterns allowed
- Defaults to all files if omitted

**Examples:**

```yaml
# TypeScript only
include: ["**/*.ts", "**/*.tsx"]

# JavaScript and TypeScript
include: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"]

# Specific directories
include: ["src/**/*.ts", "lib/**/*.ts"]

# All files (default)
include: ["**/*"]
```

### exclude (optional)

Glob patterns to exclude files.

**Rules:**

- Standard glob syntax (micromatch)
- Relative to scope path
- Applied after include patterns
- Defaults to empty if omitted

**Examples:**

```yaml
# Exclude tests
exclude: ["**/*.test.ts", "**/__tests__/**"]

# Exclude generated files
exclude: ["**/*.generated.ts", "**/dist/**", "**/build/**"]

# Exclude multiple patterns
exclude:
  - "**/*.test.ts"
  - "**/__tests__/**"
  - "**/node_modules/**"
  - "**/dist/**"
```

### rulesets (optional)

List of rule pack IDs to apply to this scope.

**Rules:**

- Rule pack IDs from sources
- Applied in order (later packs override earlier)
- Defaults to all rules if omitted

**Examples:**

```yaml
# Base + stack-specific
rulesets: ["base-rules", "nextjs-rules"]

# Multiple stack packs
rulesets: ["base-rules", "typescript-rules", "react-rules", "nextjs-rules"]

# Single ruleset
rulesets: ["python-rules"]

# All rules (default)
rulesets: []
```

## Merge order and precedence

Scopes support hierarchical rule merging with configurable order.

### Default merge order

```yaml
merge:
  strategy: "deep"
  order: ["root", "path", "local"]
```

**Merge order:**

1. **root** - Rules from workspace root config
2. **path** - Rules from scope-specific configs
3. **local** - Rules from nested/local configs

**Last writer wins:** Later sources override earlier ones.

### Merge strategies

**deep (default):**

- Merges rule properties recursively
- Preserves non-conflicting properties
- Last writer wins for conflicts

**Example:**

```yaml
# Root config
rules:
  - id: test-rule
    severity: "warn"
    applies_to: ["**/*.ts"]

# Scope config
rules:
  - id: test-rule
    severity: "error"  # Overrides root

# Result: severity="error", applies_to=["**/*.ts"]
```

### Custom merge order

```yaml
scopes:
  - path: "apps/web"
    rulesets: ["nextjs-rules"]

merge:
  strategy: "deep"
  order: ["path", "root", "local"] # Path rules take precedence over root
```

## Scenario-based examples

> **More examples:** See [STRUCTURE.md](https://github.com/AlignTrue/aligntrue/tree/main/examples/monorepo-scopes/STRUCTURE.md) in the monorepo scopes example for detailed architecture explanation.

### Scenario 1: Solo developer - Next.js + Node.js monorepo

**Goal:** Different rules for frontend and backend.

**Structure:**

```
my-app/
├── apps/
│   └── web/          # Next.js frontend
└── packages/
    └── api/          # Node.js backend
```

**Configuration:**

```yaml
sources:
  - git: https://github.com/org/base-rules
    ref: v1.0.0
  - git: https://github.com/org/nextjs-rules
    ref: v1.0.0
  - git: https://github.com/org/node-rules
    ref: v1.0.0

scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules", "nextjs-rules"]

  - path: "packages/api"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules", "node-rules"]
```

**Result:**

- `apps/web/` uses Next.js rules
- `packages/api/` uses Node.js rules
- Both share base rules

### Scenario 2: Team monorepo with multiple teams

**Goal:** Team boundaries with shared base rules.

**Structure:**

```
company-monorepo/
├── apps/
│   ├── web/          # Team A: Frontend
│   └── mobile/       # Team B: Mobile
├── packages/
│   ├── api/          # Team C: Backend
│   └── shared/       # Shared utilities
└── services/
    └── worker/       # Team D: Workers
```

**Configuration:**

```yaml
sources:
  - git: https://github.com/company/base-standards
    ref: v2.0.0
  - git: https://github.com/company/frontend-standards
    ref: v1.0.0
  - git: https://github.com/company/backend-standards
    ref: v1.0.0

scopes:
  # Team A: Frontend
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-standards", "frontend-standards"]

  # Team B: Mobile
  - path: "apps/mobile"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-standards", "frontend-standards"]

  # Team C: Backend
  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base-standards", "backend-standards"]

  # Shared: Base only
  - path: "packages/shared"
    include: ["**/*.ts"]
    rulesets: ["base-standards"]

  # Team D: Workers
  - path: "services/worker"
    include: ["**/*.ts"]
    rulesets: ["base-standards", "backend-standards"]
```

**Result:** Each team gets appropriate rules while sharing base standards.

### Scenario 3: Progressive adoption (strict in new, lenient in legacy)

**Goal:** Enforce strict rules in new code, lenient in legacy during migration.

**Structure:**

```
app/
├── src/
│   ├── new/          # New code (strict)
│   └── legacy/       # Legacy code (lenient)
└── tests/
```

**Configuration:**

```yaml
sources:
  - git: https://github.com/org/typescript-standards
    ref: v1.0.0

scopes:
  # Strict rules for new code
  - path: "src/new"
    include: ["**/*.ts"]
    rulesets: ["typescript-standards"]

  # Lenient rules for legacy (use overlays to downgrade)
  - path: "src/legacy"
    include: ["**/*.ts"]
    rulesets: ["typescript-standards"]

overlays:
  overrides:
    # Downgrade strict rules for legacy code
    - selector: "rule[id=strict-null-checks]"
      set:
        severity: "warn" # Error in new, warn in legacy
```

**Alternative with separate rule packs:**

```yaml
sources:
  - git: https://github.com/org/typescript-strict
    ref: v1.0.0
  - git: https://github.com/org/typescript-lenient
    ref: v1.0.0

scopes:
  - path: "src/new"
    rulesets: ["typescript-strict"]

  - path: "src/legacy"
    rulesets: ["typescript-lenient"]
```

### Scenario 4: Multi-stack monorepo (Next.js + Node.js + Python)

**Goal:** Different tech stacks with appropriate rules per stack.

**Structure:**

```
multi-stack/
├── apps/
│   └── web/          # Next.js (TypeScript)
├── services/
│   ├── api/          # Node.js (TypeScript)
│   └── worker/       # Python
└── packages/
    └── shared/       # Shared TypeScript utilities
```

**Configuration:**

```yaml
sources:
  - git: https://github.com/org/base-rules
    ref: v1.0.0
  - git: https://github.com/org/nextjs-rules
    ref: v1.0.0
  - git: https://github.com/org/node-rules
    ref: v1.0.0
  - git: https://github.com/org/python-rules
    ref: v1.0.0

scopes:
  # Next.js app
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts", "**/*.test.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]

  # Node.js API
  - path: "services/api"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules", "node-rules"]

  # Python worker
  - path: "services/worker"
    include: ["**/*.py"]
    exclude: ["**/*_test.py", "**/tests/**"]
    rulesets: ["base-rules", "python-rules"]

  # Shared TypeScript utilities
  - path: "packages/shared"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules"]
```

**Result:** Each stack gets appropriate rules, shared utilities use base only.

### Scenario 5: Combining scopes with plugs and overlays

**Goal:** Use all three customization features together.

**Configuration:**

```yaml
sources:
  - git: https://github.com/org/base-rules
    ref: v1.0.0
  - git: https://github.com/org/nextjs-rules
    ref: v1.0.0
  - git: https://github.com/org/node-rules
    ref: v1.0.0

# 1. Scopes: Apply different rules per path
scopes:
  - path: "apps/web"
    rulesets: ["base-rules", "nextjs-rules"]
  - path: "packages/api"
    rulesets: ["base-rules", "node-rules"]

# 2. Plugs: Fill stack-specific values
plugs:
  fills:
    test.cmd: "pnpm test"
    docs.url: "https://docs.example.com"

# 3. Overlays: Adjust severity for team
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Upgrade from warning
```

**Application order:**

1. Scopes filter rules by path
2. Plugs resolve template slots
3. Overlays apply property overrides

## CLI commands

### List configured scopes

```bash
aligntrue scopes
```

**Example output:**

```
Configured scopes (3):

apps/web
  Include: **/*.ts, **/*.tsx
  Exclude: **/*.test.ts
  Rulesets: base-rules, nextjs-rules

packages/api
  Include: **/*.ts
  Exclude: **/*.test.ts
  Rulesets: base-rules, node-rules

services/worker
  Include: **/*.py
  Rulesets: base-rules, python-rules

Merge order: root → path → local
```

### Validate scope configuration

```bash
aligntrue check
```

Validates:

- Path safety (no `..` or absolute paths)
- Glob pattern syntax
- Merge order values
- Ruleset references

See [CLI Reference](/docs/03-reference/cli-reference#aligntrue-scopes) for complete command documentation.

## Path validation

### Safety rules

AlignTrue validates scope paths to prevent security issues:

**Blocked:**

- Absolute paths: `/apps/web`
- Parent traversal: `../other`
- Backslashes: `apps\web` (use forward slashes)

**Allowed:**

- Relative paths: `apps/web`
- Nested paths: `apps/web/src`
- Workspace root: `.`

### Glob pattern validation

Glob patterns are validated for syntax errors:

```yaml
# Valid
include: ["**/*.ts", "src/**/*.tsx"]

# Invalid (syntax error)
include: ["**/*[.ts"]  # Unclosed bracket
```

### Merge order validation

Merge order must contain only valid values:

```yaml
# Valid
merge:
  order: ["root", "path", "local"]

# Invalid
merge:
  order: ["root", "invalid", "local"]  # Unknown value
  order: ["root", "path", "path"]      # Duplicate
```

## Best practices

### For solo developers

1. **Start simple** - Use scopes only when you have multiple stacks
2. **Shared base** - Use base rules across all scopes
3. **Stack-specific** - Add stack packs per scope
4. **Document structure** - Add comments explaining scope boundaries

**Example:**

```yaml
scopes:
  # Frontend: Next.js app
  - path: "apps/web"
    rulesets: ["base-rules", "nextjs-rules"]

  # Backend: Node.js API
  - path: "packages/api"
    rulesets: ["base-rules", "node-rules"]
```

### For teams

1. **Team boundaries** - Map scopes to team ownership
2. **Shared standards** - Use base rules across all teams
3. **Team-specific** - Allow team-specific overrides via overlays
4. **Document ownership** - Add comments with team names
5. **Review changes** - PR review for scope configuration changes

**Example:**

```yaml
scopes:
  # Team A: Frontend
  # Owner: @frontend-team
  - path: "apps/web"
    rulesets: ["base-standards", "frontend-standards"]

  # Team B: Backend
  # Owner: @backend-team
  - path: "packages/api"
    rulesets: ["base-standards", "backend-standards"]
```

### General best practices

1. **Minimal scopes** - Only create scopes when rules differ
2. **Clear boundaries** - Use directory structure that maps to scopes
3. **Shared base** - Maximize shared rules, minimize scope-specific
4. **Exclude tests** - Use exclude patterns for test files if rules differ
5. **Validate early** - Run `aligntrue check` after scope changes

## Troubleshooting

### Scope path validation errors

**Problem:** `Invalid scope path: absolute paths not allowed`

**Solution:** Use relative paths from workspace root:

```yaml
# Bad
scopes:
  - path: "/apps/web"  # Absolute path

# Good
scopes:
  - path: "apps/web"  # Relative path
```

**Problem:** `Invalid scope path: parent directory traversal (..) not allowed`

**Solution:** Remove `..` segments:

```yaml
# Bad
scopes:
  - path: "../other"  # Parent traversal

# Good
scopes:
  - path: "other"  # Relative to workspace root
```

### Glob pattern errors

**Problem:** `Invalid glob pattern: unclosed bracket`

**Solution:** Fix glob syntax:

```yaml
# Bad
include: ["**/*[.ts"]  # Unclosed bracket

# Good
include: ["**/*.ts"]  # Valid glob
```

### Merge order errors

**Problem:** `Invalid merge order value: must be one of root, path, local`

**Solution:** Use only valid values:

```yaml
# Bad
merge:
  order: ["root", "invalid", "local"]

# Good
merge:
  order: ["root", "path", "local"]
```

**Problem:** `Duplicate merge order value`

**Solution:** Remove duplicates:

```yaml
# Bad
merge:
  order: ["root", "path", "path"]

# Good
merge:
  order: ["root", "path", "local"]
```

### Rules not applying to scope

**Problem:** Rules defined but not applying to files in scope.

**Diagnosis:**

```bash
# Check scope configuration
aligntrue scopes

# Validate configuration
aligntrue check
```

**Common causes:**

1. Include pattern doesn't match files
2. Exclude pattern blocks files
3. Ruleset ID doesn't match source pack

**Solution:** Adjust include/exclude patterns or ruleset IDs.

### Scope conflicts

**Problem:** Multiple scopes match the same path.

**Behavior:** Last matching scope wins (scopes apply in definition order).

**Solution:** Reorder scopes or make paths more specific:

```yaml
# Ambiguous (both match apps/web/src/file.ts)
scopes:
  - path: "apps"
    rulesets: ["base-rules"]
  - path: "apps/web"
    rulesets: ["nextjs-rules"]

# Clear (more specific path wins)
scopes:
  - path: "apps/web"
    rulesets: ["nextjs-rules"]
  - path: "apps"
    rulesets: ["base-rules"]
```

## Related documentation

- [Customization Overview](/docs/02-customization) - When to use scopes vs plugs vs overlays
- [Plugs Guide](/docs/02-customization/plugs) - Stack-specific values
- [Overlays Guide](/docs/02-customization/overlays) - Rule property overrides
- [Team Mode Guide](/docs/02-concepts/team-mode) - Team collaboration with scopes
- [CLI Reference](/docs/03-reference/cli-reference#aligntrue-scopes) - Complete command docs
- [Solo Developer Guide](/docs/01-guides/solo-developer-guide) - Solo workflow with scopes
- [Team Guide](/docs/01-guides/team-guide) - Team collaboration with scopes

## Summary

**Scopes enable path-based rule application:**

1. **Monorepo support** - Different rules per directory
2. **Team boundaries** - Map scopes to team ownership
3. **Progressive adoption** - Strict in new, lenient in legacy
4. **Multi-stack** - Different tech stacks per scope
5. **Hierarchical merge** - Root → path → local precedence

**When to use:**

- Use **scopes** for path-based rule application (monorepo)
- Use **plugs** for stack-specific values (test commands, paths)
- Use **overlays** for rule property overrides (severity, inputs)

Start with simple scopes, add complexity only when needed.
