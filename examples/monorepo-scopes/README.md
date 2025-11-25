# Monorepo scopes example

This example demonstrates path-based rule application for monorepos with different tech stacks per directory.

## What's inside

- **`.aligntrue/config.yaml`** - Solo mode with scopes configuration
- **`.aligntrue/.rules.yaml`** - Internal IR (auto-generated from AGENTS.md)
- **`apps/web/`** - Next.js frontend (TypeScript + React)
- **`packages/api/`** - Node.js backend (TypeScript)
- **`services/worker/`** - Python worker service
- **`STRUCTURE.md`** - Architecture explanation
- **`test-scopes.sh`** - Validation script

## Monorepo structure

```
monorepo-scopes/
├── apps/
│   └── web/              # Next.js app (Team A: Frontend)
│       └── src/
│           └── page.tsx
├── packages/
│   └── api/              # Node.js API (Team B: Backend)
│       └── src/
│           └── server.ts
└── services/
    └── worker/           # Python worker (Team C: Data)
        └── main.py
```

Each directory gets appropriate stack-specific rules while sharing base standards.

## Quick start

### 1. View scope configuration

```bash
cat .aligntrue/.rules.yaml
```

You'll see scopes section with:

- `apps/web` → Base + Next.js rules
- `packages/api` → Base + Node.js rules
- `services/worker` → Base + Python rules

### 2. List configured scopes

```bash
# From aligntrue repo root
cd examples/monorepo-scopes
node ../../packages/cli/dist/index.js scopes
```

Expected output:

```
Configured scopes (3):

apps/web
  Include: **/*.ts, **/*.tsx
  Exclude: **/*.test.ts, **/*.test.tsx
  Rulesets: base-rules, nextjs-rules

packages/api
  Include: **/*.ts
  Exclude: **/*.test.ts
  Rulesets: base-rules, node-rules

services/worker
  Include: **/*.py
  Exclude: **/*_test.py
  Rulesets: base-rules, python-rules

Merge order: root → path → local
```

### 3. Sync with scopes

```bash
node ../../packages/cli/dist/index.js sync
```

Expected output:

```
✓ Sync complete
✓ Applied 3 scopes
Wrote 5 files:
  - .cursor/rules/*.mdc (multiple files)
  - AGENTS.md
```

### 4. Inspect scope-specific rules

Each scope gets appropriate rules:

- **Frontend (apps/web):** React hooks, Next.js patterns, client/server boundaries
- **Backend (packages/api):** Node.js best practices, API patterns, async/await
- **Worker (services/worker):** Python conventions, type hints, error handling

## Scope scenarios

### Scenario 1: Different tech stacks

**Problem:** Monorepo has Next.js, Node.js, and Python. Each needs different rules.

**Solution:** Scopes with stack-specific rulesets.

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

**Result:** Each directory gets appropriate rules for its stack.

### Scenario 2: Team boundaries

**Problem:** Different teams own different directories. Each team wants specific rules.

**Solution:** Map scopes to team ownership.

```yaml
scopes:
  # Team A: Frontend
  - path: "apps/web"
    rulesets: ["base-rules", "frontend-standards"]

  # Team B: Backend
  - path: "packages/api"
    rulesets: ["base-rules", "backend-standards"]
```

**Result:** Teams get appropriate rules without conflicts.

### Scenario 3: Exclude test files

**Problem:** Test files need different rules than source files.

**Solution:** Use exclude patterns.

```yaml
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts", "**/*.test.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]
```

**Result:** Test files excluded from scope, can have separate rules.

## Why scopes?

**Without scopes:**

- All rules apply to all files
- No way to differentiate by tech stack
- Teams can't have different standards
- Monorepo becomes one-size-fits-all

**With scopes:**

- Path-based rule application
- Different rules per tech stack
- Team-specific standards
- Shared base + scope-specific overrides

## Commands reference

### List scopes

```bash
aligntrue scopes
```

### Validate scope configuration

```bash
aligntrue check
```

### Sync with scopes

```bash
aligntrue sync
```

### View scope-specific rules

```bash
# Check which rules apply to specific file
aligntrue check apps/web/src/page.tsx

# Check which rules apply to specific directory
aligntrue check packages/api/
```

## Hierarchical merge

Scopes support hierarchical rule merging:

**Merge order:** root → path → local

1. **Root:** Rules from workspace root config
2. **Path:** Rules from scope-specific configs
3. **Local:** Rules from nested/local configs

**Last writer wins:** Later sources override earlier ones.

**Example:**

```yaml
# Root config (applies to all)
rules:
  - id: test-rule
    severity: warn

# Scope config (apps/web)
rules:
  - id: test-rule
    severity: error  # Overrides root

# Result in apps/web: severity=error
# Result elsewhere: severity=warn
```

## Validation

Run the test script to verify everything works:

```bash
./test-scopes.sh
```

This checks:

- Config file exists with scopes
- Rules file exists with scope-specific rules
- All scope directories exist
- Sync succeeds
- Scopes are configured correctly

## See also

- [Scopes guide](../../apps/docs/content/02-customization/scopes.md) - Complete scopes documentation
- [STRUCTURE.md](./STRUCTURE.md) - Architecture explanation
- [Team repo example](../team-repo/) - Team workflows with scopes
