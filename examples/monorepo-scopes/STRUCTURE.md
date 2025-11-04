# Monorepo structure

This document explains the architecture and scope configuration for the monorepo example.

## Directory structure

```
monorepo-scopes/
├── apps/
│   └── web/                    # Next.js frontend
│       └── src/
│           └── page.tsx        # React component
├── packages/
│   └── api/                    # Node.js backend
│       └── src/
│           └── server.ts       # Express server
└── services/
    └── worker/                 # Python worker
        └── main.py             # Data processing
```

## Scope mapping

### Scope 1: Frontend (apps/web)

**Owner:** Team A (Frontend)

**Tech stack:** Next.js, React, TypeScript

**Rules applied:**

- Base rules (secrets, tests, todos)
- Next.js rules (server/client boundaries, image optimization)

**Configuration:**

```yaml
- path: "apps/web"
  include: ["**/*.ts", "**/*.tsx"]
  exclude: ["**/*.test.ts", "**/*.test.tsx"]
  rulesets: ["base-rules", "nextjs-rules"]
```

**Files affected:**

- `apps/web/src/page.tsx` ✓
- `apps/web/src/components/*.tsx` ✓
- `apps/web/src/**/*.test.tsx` ✗ (excluded)

### Scope 2: Backend (packages/api)

**Owner:** Team B (Backend)

**Tech stack:** Node.js, Express, TypeScript

**Rules applied:**

- Base rules (secrets, tests, todos)
- Node.js rules (async/await, error handling)

**Configuration:**

```yaml
- path: "packages/api"
  include: ["**/*.ts"]
  exclude: ["**/*.test.ts"]
  rulesets: ["base-rules", "node-rules"]
```

**Files affected:**

- `packages/api/src/server.ts` ✓
- `packages/api/src/**/*.ts` ✓
- `packages/api/src/**/*.test.ts` ✗ (excluded)

### Scope 3: Worker (services/worker)

**Owner:** Team C (Data)

**Tech stack:** Python

**Rules applied:**

- Base rules (secrets, tests, todos)
- Python rules (type hints, docstrings)

**Configuration:**

```yaml
- path: "services/worker"
  include: ["**/*.py"]
  exclude: ["**/*_test.py", "**/tests/**"]
  rulesets: ["base-rules", "python-rules"]
```

**Files affected:**

- `services/worker/main.py` ✓
- `services/worker/**/*.py` ✓
- `services/worker/**/*_test.py` ✗ (excluded)

## Rule inheritance

### Base rules (all scopes)

Applied to all scopes:

1. **base.no-secrets** (error)
   - Never commit secrets
   - Applies to: `**/*`

2. **base.require-tests** (error)
   - All features need tests
   - Applies to: `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.py`

3. **base.no-todos** (warn)
   - Convert TODOs to issues
   - Applies to: `**/*`

### Stack-specific rules

Each scope gets additional stack-specific rules:

**Next.js (apps/web):**

- `nextjs.server-client-boundary` (error)
- `nextjs.image-optimization` (warn)

**Node.js (packages/api):**

- `node.async-await` (warn)
- `node.error-handling` (error)

**Python (services/worker):**

- `python.type-hints` (warn)
- `python.docstrings` (info)

## Merge behavior

**Merge strategy:** deep (recursive merge)

**Merge order:** root → path → local

### Example: Overriding severity

```yaml
# Root config (applies to all)
rules:
  - id: base.require-tests
    severity: warn

# Scope config (apps/web)
rules:
  - id: base.require-tests
    severity: error  # Overrides root

# Result:
# - apps/web: severity=error (scope override)
# - packages/api: severity=warn (root default)
# - services/worker: severity=warn (root default)
```

## Team boundaries

### Team A: Frontend

**Responsibility:** Next.js app, UI components, client-side logic

**Scope:** `apps/web`

**Rules focus:**

- React best practices
- Next.js patterns
- Client/server boundaries
- Image optimization

### Team B: Backend

**Responsibility:** API server, business logic, database

**Scope:** `packages/api`

**Rules focus:**

- Async/await patterns
- Error handling
- API design
- Node.js best practices

### Team C: Data

**Responsibility:** Data processing, workers, batch jobs

**Scope:** `services/worker`

**Rules focus:**

- Type hints
- Documentation
- Error handling
- Python conventions

## Adding new scopes

To add a new scope:

1. **Create directory structure:**

   ```bash
   mkdir -p new-scope/src
   ```

2. **Add scope configuration:**

   ```yaml
   scopes:
     - path: "new-scope"
       include: ["**/*.ts"]
       rulesets: ["base-rules", "new-rules"]
   ```

3. **Define scope-specific rules:**

   ```yaml
   rules:
     - id: new-scope.rule-name
       summary: Rule description
       severity: error
       applies_to:
         patterns: ["new-scope/**/*.ts"]
   ```

4. **Sync and validate:**
   ```bash
   aligntrue sync
   aligntrue scopes
   ```

## Best practices

### 1. Shared base

Maximize shared rules across scopes:

- Common standards (secrets, tests, todos)
- Organization-wide policies
- Security requirements

### 2. Minimal scope-specific

Only add scope-specific rules when necessary:

- Stack-specific patterns
- Team-specific requirements
- Technology constraints

### 3. Clear boundaries

Use directory structure that maps to scopes:

- One scope per major directory
- Clear team ownership
- Logical separation

### 4. Exclude tests

Use exclude patterns for test files:

- Tests may need different rules
- Avoid false positives
- Keep test code flexible

### 5. Document ownership

Add comments with team ownership:

```yaml
scopes:
  # Team A: Frontend
  - path: "apps/web"
    rulesets: ["base-rules", "nextjs-rules"]
```

## Troubleshooting

### Rules not applying to scope

**Problem:** Rules defined but not applying to files in scope.

**Check:**

1. Include pattern matches files
2. Exclude pattern doesn't block files
3. Ruleset ID matches source pack

**Solution:** Adjust include/exclude patterns or ruleset IDs.

### Multiple scopes match same path

**Problem:** Two scopes match the same file.

**Behavior:** Last matching scope wins (scopes apply in definition order).

**Solution:** Reorder scopes or make paths more specific.

### Scope path validation error

**Problem:** Invalid scope path (absolute, parent traversal).

**Solution:** Use relative paths from workspace root:

```yaml
# Good
path: "apps/web"

# Bad
path: "/apps/web"  # Absolute
path: "../other"   # Parent traversal
```
