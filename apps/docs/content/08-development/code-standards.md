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
- `computeContentHash(obj: unknown): string` - Hash an object after canonicalization
- `hashObject(obj: unknown): string` - Convenience wrapper

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
- `stringifyCanonical(obj: unknown): string` - Canonical JSON
- `computeContentHash(obj: unknown): string` - Hash an object deterministically
- `compareCanonical(a: unknown, b: unknown): boolean` - Compare by canonical form
- `type Result<T, E>` - Result type for operations that may fail

**Locations where JSON utilities are recommended:**

- Object cloning in overlay operations
- Pack hashing before resolution
- Type-safe parsing of untrusted JSON

### Canonicalization

**Use `canonicalizeJson()` and `computeAlignHash()` for deterministic operations:**

```typescript
// ✅ Do: use schema utilities for determinism
import { canonicalizeJson, computeAlignHash } from "@aligntrue/schema";

const canonical = canonicalizeJson(obj, true); // with volatile filtering
const hash = computeAlignHash(yamlString);
```

## Error handling

### CLI errors

Use the error hierarchy from `@aligntrue/cli/utils/error-types` in CLI commands:

```typescript
import {
  ConfigError,
  ValidationError,
  SyncError,
} from "@aligntrue/cli/utils/error-types";

// Create descriptive errors
throw new ConfigError(
  "Invalid config field",
  "Set profile.id in .aligntrue/config.yaml",
).withNextSteps(["Run 'aligntrue init'", "Edit: aligntrue config edit"]);
```

### Core package errors

Keep error messages clear and actionable. Use `throw new Error()` with descriptive messages:

```typescript
// ✅ Good
throw new Error(
  `Failed to load config from ${path}: ${details}\n` +
    `Hint: Run 'aligntrue init' to create a config file`,
);

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
await writer.write(filePath, content);
// Handles atomicity, checksums, and rollback
```

### Large datasets

The schema package provides performance guardrails:

```typescript
import { checkFileSize } from "@aligntrue/core/performance";

checkFileSize(filePath, 100, "team", force);
// Validates file size with mode-dependent behavior
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

## Related rules

- See [Debugging workflow](/docs/08-development/workspace#debugging-workflow) for investigation patterns
- See [Documentation standards](/docs/08-development/architecture#documentation) for docs authoring
- See [Testing decision framework](/docs/08-development/test-maintenance) for test strategy
