# @aligntrue/schema

JSON Schema validation, canonicalization, and integrity hashing for AlignTrue Align packs.

## Overview

This package provides the core validation and canonicalization utilities for Align Spec v2-preview:

- **JSON Schema validation** using Ajv in strict mode
- **JCS (RFC 8785) canonicalization** for lockfile and catalog publishing only
- **SHA-256 integrity hashing** with verification
- **TypeScript types** for Align pack structure

## Canonicalization Strategy

**Important:** Canonicalization is ONLY performed at boundaries where determinism is required:

- **Lockfile generation** (`aligntrue lock` in team mode)
- **Catalog publishing** (`aligntrue publish` - removed from roadmap)

**NOT used during:** init, sync, export, import, or normal file operations.

**Why:** Solo developers don't need canonicalization overhead for local files. Team mode only needs determinism for lockfile-based drift detection. Running canonicalization on every operation adds unnecessary cost.

## Installation

```bash
pnpm add @aligntrue/schema
```

## API Reference

### Canonicalization

#### `parseYamlToJson(yaml: string): unknown`

Parse YAML string to JavaScript object. Resolves anchors and aliases.

```typescript
import { parseYamlToJson } from "@aligntrue/schema";

const yaml = 'id: "packs/test/example"\nversion: "1.0.0"';
const obj = parseYamlToJson(yaml);
```

#### `canonicalizeJson(obj: unknown): string`

Apply JCS (RFC 8785) canonicalization to produce stable JSON string with deterministic key ordering.

```typescript
import { canonicalizeJson } from "@aligntrue/schema";

const obj = { z: 1, a: 2, m: 3 };
const canonical = canonicalizeJson(obj);
// Result: '{"a":2,"m":3,"z":1}'
```

#### `computeHash(data: string): string`

Compute SHA-256 hash of a string and return hex-encoded result.

```typescript
import { computeHash } from "@aligntrue/schema";

const hash = computeHash("hello world");
// Result: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
```

#### `computeAlignHash(alignYaml: string): string`

Compute integrity hash for an Align pack YAML document. This function:

1. Parses YAML to object
2. Sets `integrity.value` to `"<pending>"`
3. Applies JCS canonicalization
4. Computes SHA-256 hash

```typescript
import { computeAlignHash } from "@aligntrue/schema";

const yaml = `
id: "packs/test/example"
version: "1.0.0"
profile: "align"
spec_version: "1"
...
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
`;

const hash = computeAlignHash(yaml);
// Result: hex-encoded SHA-256 hash (64 characters)
```

#### `verifyAlignHash(alignYaml: string, storedHash: string): boolean`

Verify that a stored hash matches the computed hash.

```typescript
import { verifyAlignHash } from "@aligntrue/schema";

const isValid = verifyAlignHash(alignYaml, storedHash);
```

### Validation

#### `validateAlignSchema(obj: unknown): ValidationResult`

Validate an Align pack object against the JSON Schema.

```typescript
import { validateAlignSchema } from "@aligntrue/schema";

const result = validateAlignSchema(packObject);
if (!result.valid) {
  console.error("Schema validation failed:", result.errors);
}
```

**ValidationResult:**

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}
```

#### `validateAlignIntegrity(alignYaml: string): IntegrityResult`

Validate the integrity hash of an Align pack.

```typescript
import { validateAlignIntegrity } from "@aligntrue/schema";

const result = validateAlignIntegrity(alignYaml);
if (!result.valid) {
  console.error("Hash mismatch!");
  console.error(`Stored:   ${result.storedHash}`);
  console.error(`Computed: ${result.computedHash}`);
}
```

**IntegrityResult:**

```typescript
interface IntegrityResult {
  valid: boolean;
  storedHash?: string;
  computedHash?: string;
  error?: string;
}
```

#### `validateAlign(alignYaml: string)`

Validate both schema and integrity of an Align pack in one call.

```typescript
import { validateAlign } from "@aligntrue/schema";

const result = validateAlign(alignYaml);
if (!result.schema.valid) {
  console.error("Schema errors:", result.schema.errors);
}
if (!result.integrity.valid) {
  console.error("Integrity error:", result.integrity.error);
}
```

### TypeScript Types

Export types for Align pack structure:

```typescript
import type {
  AlignPack,
  AlignScope,
  AlignSection,
  AlignIntegrity,
} from "@aligntrue/schema";

const pack: AlignPack = {
  id: "packs/test/example",
  version: "1.0.0",
  spec_version: "1",
  summary: "Example pack",
  tags: ["test"],
  sections: [
    {
      id: "section-1",
      heading: "Getting started",
      level: 1,
      content: "Introduction to the pack",
    },
  ],
  integrity: {
    algo: "jcs-sha256",
    value: "<computed>",
  },
};
```

## CLI Scripts

### Validate an Align pack

```bash
pnpm validate path/to/pack.yaml
```

Output shows schema validation, integrity validation, and overall status.

### Compute hashes for multiple files

```bash
node --import tsx --no-warnings scripts/compute-basealign-hashes.ts
```

This script processes all `.yaml` files in the `basealigns/` directory and updates their integrity hashes.

## Development

### Run tests

```bash
pnpm test
```

### Watch mode

```bash
pnpm test:watch
```

### Type check

```bash
pnpm typecheck
```

### Build

```bash
pnpm build
```

## Determinism Guarantees

This package ensures deterministic hashing through:

1. **JCS canonicalization (RFC 8785)**: Stable key ordering, precise float representation
2. **YAML normalization**: Anchors and aliases resolved before hashing
3. **Placeholder handling**: `integrity.value` set to `"<pending>"` during hash computation
4. **UTF-8 encoding**: Consistent byte representation

The same Align pack content will always produce the same hash, regardless of:

- Key ordering in YAML
- Whitespace or formatting
- YAML anchors vs explicit duplication
- Machine or environment

## References

- [Align Spec v2-preview (CLI-first)](../../spec/align-spec-v2-cli-first.md)
- [Align Spec v1 (superseded)](../../spec/align-spec-v1.md)
- [JCS (RFC 8785)](https://www.rfc-editor.org/rfc/rfc8785)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/)

## License

MIT
