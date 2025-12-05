---
title: Code standards
description: TypeScript, testing, and shared utility patterns for AlignTrue development.
---

# Code standards

AlignTrue maintains consistent patterns across packages to improve maintainability and reduce duplication.

## Shared utilities from @aligntrue/schema

The schema package exports high-quality utilities that should be used throughout the codebase to maintain consistency.

### Hashing and cryptography

**Use `computeHash()` instead of raw `createHash()`:**

```typescript
// ❌ Don't: raw crypto operations scattered across code
import { createHash } from "crypto";
const hash = createHash("sha256").update(content).digest("hex");

// ✅ Do: use centralized utility
import { computeHash } from "@aligntrue/schema";
const hash = computeHash(content);
```

**Benefits:**

- Single source of truth for cryptographic operations
- Easier to update algorithm if needed
- Consistent across all packages
- Already handles encoding/formatting

**Available functions:**

- `computeHash(data: string): string` - SHA-256 hash
- `computeContentHash(obj: unknown, excludeVolatile = true): string` - Canonicalize (drops `vendor.*.volatile` by default) + SHA-256
- `hashObject(obj: unknown): string` - Convenience wrapper
- `computeAlignHash(input: string | unknown): string` - Resets `integrity.value` to `<pending>`, filters volatile vendor fields, then hashes

**Locations where hashing is used:**

- File checksum computation (`file-utils`)
- Git repository hashing (`sources`)
- Content change detection (`core/tracking`)
- Section hashing in sync operations

### JSON utilities

**Use `cloneDeep()` instead of `JSON.parse(JSON.stringify())`:**

```typescript
// ❌ Don't: structural cloning anti-pattern
const clone = JSON.parse(JSON.stringify(obj));

// ✅ Do: use native structuredClone with fallback
import { cloneDeep } from "@aligntrue/schema";
const clone = cloneDeep(obj);
```

**Benefits:**

- Uses native `structuredClone()` for better performance
- Handles more types (Date, Map, Set, etc.)
- Explicit intent in code
- Fallback for older environments (though not needed for Node 20+)

**Available functions:**

- `cloneDeep<T>(obj: T): T` - Deep clone using structuredClone
- `parseJsonSafe(str: string): Result<unknown, Error>` - Parse with error handling
- `stringifyCanonical(obj: unknown, excludeVolatile = true): string` - Canonical JSON (drops `vendor.*.volatile` by default)
- `computeContentHash(obj: unknown, excludeVolatile = true): string` - Deterministic hash (canonical JSON + SHA-256)
- `compareCanonical(a: unknown, b: unknown): boolean` - Compare by canonical form
- `type Result<T, E>` - Result type for operations that may fail

**Locations where JSON utilities are recommended:**

- Object cloning in overlay operations
- Align hashing before resolution
- Type-safe parsing of untrusted JSON

### Canonicalization

**Use `canonicalizeJson()` and `computeAlignHash()` for deterministic operations (defaults exclude `vendor.*.volatile`):**

```typescript
// ✅ Do: use schema utilities for determinism
import { canonicalizeJson, computeAlignHash } from "@aligntrue/schema";

const canonical = canonicalizeJson(obj); // volatile fields dropped by default
const hash = computeAlignHash(yamlString); // sets integrity.value to <pending> before hashing
```

## Error handling

### CLI errors

Use the structured error hierarchy (re-exported by `@aligntrue/cli/utils/error-types`, defined in `@aligntrue/core`) so exit codes, hints, and next steps stay consistent:

```typescript
import {
  AlignTrueError,
  ConfigError,
  ValidationError,
  SyncError,
  ErrorFactory,
} from "@aligntrue/cli/utils/error-types";

// Create descriptive errors with actionable guidance
throw new ConfigError(
  "Invalid config field: profile.id missing",
  "Set profile.id in .aligntrue/config.yaml",
).withNextSteps(["Run: aligntrue init", "Edit: aligntrue config edit"]);

// Prefer ErrorFactory helpers for common cases
throw ErrorFactory.configNotFound(configPath);

// Use AlignTrueError (base) only when none of the typed errors fit
throw new AlignTrueError(
  "Unexpected state while resolving plugs",
  "UNEXPECTED_STATE",
  1,
);
```

### Core package errors

Keep error messages clear and actionable. Use the typed errors above for user-facing failures; reserve bare `Error` for internal invariants only:

```typescript
// ✅ Good (user-facing)
throw ErrorFactory.fileWriteFailed(path, cause);

// ✅ Good (internal invariant)
if (!graph.has(node)) {
  throw new Error(`Invariant: node ${node} should exist before traversal`);
}

// ❌ Avoid
throw new Error("Config load failed");
```

## Testing patterns

### Test organization

Mirror source layout in tests:

```
packages/core/
  src/
    sync/
      engine.ts
    config/
      index.ts
  tests/
    sync/
      engine.test.ts
    config/
      index.test.ts
```

### Fixtures and factories

Create reusable test fixtures near complex logic:

```typescript
// packages/core/tests/helpers/test-fixtures.ts
export function createMockConfig(
  overrides?: Partial<AlignTrueConfig>,
): AlignTrueConfig {
  return {
    version: "1.0.0",
    mode: "solo",
    ...overrides,
  };
}
```

## Performance considerations

### File operations

Use the centralized `AtomicFileWriter` from `@aligntrue/file-utils`:

```typescript
import { AtomicFileWriter } from "@aligntrue/file-utils";

const writer = new AtomicFileWriter();
// Optional: prompt-aware checksum handler to protect manual edits
// writer.setChecksumHandler(async (...) => "overwrite" | "keep" | "abort");

await writer.write(filePath, content, { interactive, force });
// Handles atomicity, checksum tracking, overwrite protection, rollback
```

### Large datasets

The schema package provides performance guardrails:

```typescript
import { checkFileSize } from "@aligntrue/core/performance";

checkFileSize(filePath, 100, "team", force);
// Solo: warns; Team/enterprise: throws; Force: bypasses
```

## Package dependencies

### Core package constraints

- **Core (`@aligntrue/core`)**: No UI dependencies
  - Remove unused `@clack/prompts` (only CLI needs this)
  - Focus on config, sync, and validation logic

- **CLI (`@aligntrue/cli`)**: Can depend on UI and prompts
  - Use `@clack/prompts` for interactive prompts
  - Depends on core for business logic

- **Schema (`@aligntrue/schema`)**: No external business logic
  - Validation, hashing, canonicalization only
  - Depended on by all other packages

### Import order

Within files, use this order:

```typescript
// 1. Standard library
import { promises as fs } from "fs";
import { join } from "path";

// 2. Third-party packages
import { parse } from "yaml";

// 3. Local workspace packages
import { computeHash } from "@aligntrue/schema";
import { loadConfig } from "./config/index.js";

// 4. Relative imports
import { helper } from "../utils/helper.js";
```

## Documentation

### When to add documentation

- **Add**: Feature behavior, configuration options, CLI commands, public APIs
- **Skip**: Internal refactors, implementation details that don't affect users
- **Update**: When user-facing behavior changes

### Keep documentation current

Use the `validation/docs` check to ensure:

- Node.js version requirements match `package.json`
- CLI command counts match implementation
- Exporter counts match directory listing

```bash
pnpm validate:docs
```

## Related documentation

- [CI guide](/docs/06-development/ci) for validation and debugging workflow
- [Architecture](/docs/06-development/architecture) for design principles
- [Test maintenance](/docs/06-development/test-maintenance) for test strategy
