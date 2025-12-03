---
title: Scopes
description: Path-based rule application for monorepos with hierarchical merge order
---

# Scopes guide

<Callout type="info">
  **Solo developer?** You can skip this page unless you're working in a monorepo with different rules per directory. Most solo projects don't need scopes.
</Callout>

Scopes enable path-based rule application for monorepos. Apply different rules to frontend vs backend, new code vs legacy, or team-specific directories while maintaining a shared base.

> **See it in action:** Check out the [monorepo scopes example](https://github.com/AlignTrue/aligntrue/tree/main/examples/monorepo-scopes) for a working demonstration.

> **Real-world scenarios:** See [5 complete examples](#scenarios) below for progressive adoption, team boundaries, multi-stack monorepos, frontend-backend splits, and microservices.

**On this page:** [Concepts](#quick-example) · [Configuration](#scope-properties) · [Scenarios](#scenarios) · [Performance](#performance-characteristics)

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

See [real-world scenarios](#scenarios) for complete configurations of these patterns.

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

List of rule align IDs to apply to this scope.

**Rules:**

- Rule align IDs from sources
- Applied in order (later aligns override earlier)
- Defaults to all rules if omitted

**Examples:**

```yaml
# Base + stack-specific
rulesets: ["base-rules", "nextjs-rules"]

# Multiple stack aligns
rulesets: ["base-rules", "typescript-rules", "react-rules", "nextjs-rules"]

# Single ruleset
rulesets: ["python-rules"]

# All rules (default)
rulesets: []
```

## Nested agent files

When scopes are configured, AlignTrue creates scope-specific agent files in nested directories, matching industry patterns like AGENTS.md's "nearest file wins" behavior.

### Export structure

For each scope, agent files are written to the scope's directory:

```
# Config with 3 scopes
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base", "nextjs"]
  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base", "node"]
  - path: "services/worker"
    include: ["**/*.py"]
    rulesets: ["base", "python"]

# Produces nested agent files:
apps/web/.cursor/rules/web.mdc              # Cursor export for web scope
apps/web/AGENTS.md                          # AGENTS export for web scope
packages/api/.cursor/rules/*.mdc             # Cursor exports for api scope (one file per rule)
packages/api/AGENTS.md                      # AGENTS export for api scope
services/worker/.cursor/rules/*.mdc         # Cursor exports for worker scope (one file per rule)
services/worker/AGENTS.md                   # AGENTS export for worker scope
.cursor/rules/*.mdc                         # Root rules (no scope, one file per rule)
AGENTS.md                                   # Root rules (no scope)
```

### How agents discover files

**Cursor:**

- Supports multiple `.cursor/rules/` directories in subprojects
- Each scope gets its own `.cursor/rules/{scope-name}.mdc` file
- Globs in frontmatter match scope include patterns

**AGENTS.md:**

- "Nearest file wins" - agents walk up the directory tree
- Working on `apps/web/src/index.ts` → reads `apps/web/AGENTS.md`
- Working on `packages/api/src/server.ts` → reads `packages/api/AGENTS.md`
- OpenAI repo has 88 nested AGENTS.md files for subproject-specific instructions

### Glob patterns in exports

Scope include patterns are automatically added to exported files:

**Cursor `.mdc` frontmatter:**

```yaml
---
alwaysApply: true
globs:
  - "**/*.ts"
  - "**/*.tsx"
---
```

**Benefits:**

- Agents only load rules relevant to current file
- Reduces token usage and context pollution
- Enables fine-grained rule targeting

### Backward compatibility

If no scopes are configured, behavior is unchanged:

- Root `.cursor/rules/*.mdc` (one file per rule)
- Root `AGENTS.md`
- Multi-file exports per rule as standard

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

**Alternative with separate rule aligns:**

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

See [CLI Reference](/docs/04-reference/cli-reference/team#aligntrue-scopes) for complete command documentation.

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
3. **Stack-specific** - Add stack aligns per scope
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
3. Ruleset ID doesn't match source align

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

## Scenarios

Real-world examples showing how to use scopes for common monorepo challenges:

- [Progressive Adoption](#progressive-adoption) - Different rules for new vs legacy code
- [Team boundaries](#team-boundaries) - Different teams own different directories
- [Multi-Stack Monorepo](#multi-stack-monorepo) - Multiple languages/tech stacks
- [Frontend-Backend Split](#frontend-backend-split) - Separate concerns
- [Microservices architecture](#microservices-architecture) - Service-specific rules

### Progressive adoption

**Problem:** You're migrating a large codebase to stricter standards but can't fix everything at once. You need strict rules enforced in new code while keeping lenient rules in legacy code during the migration period.

**Solution:** Use scopes to apply different rulesets based on directory, allowing gradual migration without breaking CI.

**Configuration:**

```yaml
version: "1"
mode: solo

scopes:
  - path: "src/new"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["typescript-strict"]

  - path: "src/legacy"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["typescript-lenient"]

merge:
  strategy: "deep"
  order: ["root", "path", "local"]

exporters:
  - agents-md
  - cursor
```

**Expected outcome:** New code in `src/new/` enforces strict TypeScript rules (no `any`, strict null checks, etc.) while legacy code in `src/legacy/` uses lenient rules (warnings instead of errors). New code can't regress to legacy standards, and legacy code can be gradually migrated.

**Keywords:** progressive adoption, gradual migration, strict rules, legacy code, refactoring, incremental improvement

### Team boundaries

**Problem:** Multiple teams work in the same monorepo with different standards. Frontend team owns `apps/web` and `apps/mobile`, backend team owns `packages/api` and `services/*`, and platform team owns `packages/shared`. Each team needs their own rules while sharing base standards.

**Solution:** Use scopes to apply team-specific rulesets while maintaining shared base standards across all teams.

**Configuration:**

```yaml
version: "1"
mode: team

scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-standards", "frontend-standards"]

  - path: "apps/mobile"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-standards", "frontend-standards"]

  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base-standards", "backend-standards"]

  - path: "services"
    include: ["**/*.ts"]
    rulesets: ["base-standards", "backend-standards"]

  - path: "packages/shared"
    include: ["**/*.ts"]
    rulesets: ["base-standards"]

exporters:
  - agents-md
  - cursor
```

**Expected outcome:** Frontend team gets React/Next.js specific rules, backend team gets Node.js/API specific rules, shared packages follow base standards only. Teams maintain autonomy while sharing core values.

**Keywords:** team ownership, different teams, team-specific rules, organizational boundaries, ownership, monorepo teams

### Multi-Stack Monorepo

**Problem:** Your monorepo uses multiple tech stacks: `apps/web` uses Next.js (TypeScript + React), `packages/api` uses Node.js (TypeScript), `services/worker` uses Python, and `services/ml` uses Python + Jupyter. Each stack needs language-specific rules.

**Solution:** Use scopes with stack-specific rulesets for each language and framework.

**Configuration:**

```yaml
version: "1"
mode: solo

scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts", "**/*.test.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]

  - path: "packages/api"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules", "node-rules"]

  - path: "services/worker"
    include: ["**/*.py"]
    exclude: ["**/*_test.py"]
    rulesets: ["base-rules", "python-rules"]

  - path: "services/ml"
    include: ["**/*.py", "**/*.ipynb"]
    exclude: ["**/*_test.py"]
    rulesets: ["base-rules", "python-rules", "jupyter-rules"]

merge:
  strategy: "deep"
  order: ["root", "path", "local"]

exporters:
  - agents-md
  - cursor
```

**Expected outcome:** Next.js app gets React component rules, Node.js API gets server-side rules, Python services get PEP 8 rules, ML service gets Jupyter notebook rules. Each stack maintains best practices for its language and framework.

**Keywords:** multiple languages, polyglot, Next.js and Node.js and Python, different tech stacks, mixed languages, multi-language monorepo

### Frontend-Backend Split

**Problem:** Your repository has clear frontend/backend separation with `frontend/` containing a React web application and `backend/` containing a REST API server. Each side needs different rules and tooling.

**Solution:** Use scopes to separate concerns with appropriate rules for each side.

**Configuration:**

```yaml
version: "1"
mode: solo

scopes:
  - path: "frontend"
    include: ["**/*.ts", "**/*.tsx", "**/*.jsx"]
    exclude: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"]
    rulesets: ["base-rules", "react-rules", "ui-rules"]

  - path: "backend"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts", "**/__tests__/**"]
    rulesets: ["base-rules", "api-rules", "security-rules"]

merge:
  strategy: "deep"
  order: ["root", "path", "local"]

exporters:
  - agents-md
  - cursor
```

**Expected outcome:** Frontend gets React, accessibility, and UI rules. Backend gets API design, security, and database rules. No cross-contamination of concerns, clear separation of responsibilities.

**Keywords:** frontend and backend, web app and API, client and server, separate concerns, full-stack monorepo

### Microservices architecture

**Problem:** Your monorepo contains multiple microservices: `services/auth` (authentication), `services/payments` (payment processing), `services/notifications` (email/SMS), and `services/analytics` (data analytics). Each service needs service-specific rules while sharing base standards.

**Solution:** Use scopes for each service with shared base rules and service-specific additions.

**Configuration:**

```yaml
version: "1"
mode: team

scopes:
  - path: "services/auth"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-standards", "auth-rules", "security-rules"]

  - path: "services/payments"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets:
      ["base-standards", "payment-rules", "security-rules", "pci-compliance"]

  - path: "services/notifications"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-standards", "notification-rules"]

  - path: "services/analytics"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-standards", "analytics-rules", "data-privacy"]

merge:
  strategy: "deep"
  order: ["root", "path", "local"]

exporters:
  - agents-md
  - cursor
```

**Expected outcome:** Each service gets appropriate domain-specific rules. Security-critical services (auth, payments) get extra scrutiny. Compliance rules applied where needed (PCI, data privacy). All services share base standards.

**Keywords:** microservices, multiple services, service-specific rules, shared base rules, service boundaries, domain-driven design

## Performance characteristics

**Scope resolution:**

- O(n) where n = number of scopes (typically < 10)
- Path matching uses fast glob patterns
- Resolved once at config load, cached for sync operations
- No performance impact on large monorepos (1000+ files)

**Memory usage:**

- Minimal overhead: ~1KB per scope configuration
- Scope-specific exports cached in memory during sync
- No impact on bundle or lockfile size

**Best practices:**

- Keep scope count under 20 for optimal performance
- Use specific paths over broad patterns when possible
- Prefer `include`/`exclude` over complex glob patterns

## Related documentation

- [Customization Overview](/docs/02-customization) - When to use scopes vs plugs vs overlays
- [Plugs Guide](/docs/02-customization/plugs) - Stack-specific values
- [Overlays Guide](/docs/02-customization/overlays) - Rule property overrides
- [Team Mode Guide](/docs/03-concepts/team-mode) - Team collaboration with scopes
- [CLI Reference](/docs/04-reference/cli-reference/team#aligntrue-scopes) - Complete command docs
- [Solo Developer Guide](/docs/01-guides/01-solo-developer-guide) - Solo workflow with scopes
- [Team Guide](/docs/01-guides/02-team-guide) - Team collaboration with scopes

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
