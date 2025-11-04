# YAML Library Design Decisions

This document explains AlignTrue's YAML parsing and handling approach.

## Overview

AlignTrue uses `js-yaml` for YAML parsing with careful handling of canonicalization boundaries.

## Design principles

1. **Parse as YAML, validate as JSON**
   - Accept YAML's flexibility for authoring (comments, anchors, multi-line strings)
   - Validate against JSON Schema for deterministic structure
   - Canonicalize only at lock/publish boundaries

2. **Preserve human-friendly authoring**
   - Keep `.aligntrue.yaml` files human-editable
   - Support comments and YAML features users expect
   - Don't force JSON-only constraints

3. **Determinism at boundaries**
   - Lockfile generation: YAML → IR → JCS → hash
   - Catalog publishing: YAML → IR → JCS → hash
   - Normal operations: Work with IR directly (no canonicalization overhead)

## Library choice: js-yaml

**Why js-yaml:**

- ✅ Mature, well-tested, widely used
- ✅ Supports YAML 1.2 spec
- ✅ Handles comments, anchors, multi-line strings
- ✅ Good error messages for invalid YAML
- ✅ npm ecosystem standard (41M weekly downloads)

**Alternatives considered:**

- `yaml` (Eemeli Aro): More modern but less adoption
- `js-yaml-parser`: Lower-level, more complex API
- Custom parser: Not worth the maintenance burden

## Canonicalization strategy

### When to Canonicalize

**DO canonicalize:**

- Lockfile generation (`aligntrue lock` in team mode)
- Catalog publishing (`aligntrue publish` in Phase 4)

**DON'T canonicalize:**

- Init, sync, export, import
- Normal file operations
- Every read/write cycle

**Why:**

- Solo devs don't need determinism overhead for local files
- Team mode only needs determinism for drift detection
- Catalog publishing needs integrity hash at distribution boundary
- Simpler mental model: rules are just files until you lock/publish

### Canonicalization Pipeline

```
YAML file
  ↓ js-yaml.load()
IR (JavaScript objects)
  ↓ normalizeYamlToJson() - strip undefined, sort keys
JSON
  ↓ JCS (RFC 8785) - canonical JSON serialization
Canonical JSON string
  ↓ SHA-256
Content hash
```

**Key steps:**

1. Parse YAML with `js-yaml`
2. Normalize to plain JSON (strip YAML-specific constructs)
3. Apply JCS for stable key order and number formatting
4. Hash with SHA-256

See `packages/schema/src/canonicalize.ts` for implementation.

## Edge cases

### Comments

- Preserved during parsing but stripped during canonicalization
- Not included in content hashes
- Safe to use in `.aligntrue.yaml` files

### Anchors and Aliases

- YAML anchors (`&anchor`) and aliases (`*alias`) are expanded during parsing
- Not preserved in IR or exports
- Use sparingly (can make diffs harder to read)

### Multi-line Strings

- Supported: `|` (literal), `>` (folded)
- Normalized to single-line JSON strings in canonical form
- Use for long descriptions or content

### Undefined vs Null

- `undefined` values stripped during normalization
- `null` values preserved
- Omit optional fields rather than setting to `null`

## Validation approach

1. **Parse YAML** with `js-yaml`
2. **Validate IR** with Ajv (JSON Schema validator) in strict mode
3. **Report errors** with human-friendly messages

**Why Ajv:**

- Strict mode catches common errors (typos, extra properties)
- Fast validation (compiled schemas)
- Good error messages with custom formatting

## Migration to YAML 1.2

AlignTrue uses YAML 1.2 spec (via `js-yaml` defaults):

- Boolean: `true`, `false` (not `yes`, `no`, `on`, `off`)
- Null: `null` (not `~`)
- Octal: `0o` prefix (not leading zero)

**Pre-1.0 policy:** Schema can iterate freely. Post-1.0: Breaking changes require migration tooling.

## Testing strategy

**Golden files:**

- `examples/golden-repo/` - Known-good YAML files
- Tests verify: YAML → IR → hash stability

**Conformance vectors:**

- `packages/testkit/vectors/` - Edge cases and validation
- Test malformed YAML, schema violations, boundary conditions

**Round-trip tests:**

- YAML → IR → export → import → IR
- Verify fidelity through full cycle

## Performance considerations

- **YAML parsing:** ~1ms for typical `.aligntrue.yaml` (~5KB)
- **Canonicalization:** ~2ms for same file
- **Total overhead:** <5ms per file (acceptable for CLI use)

**Optimization:**

- Cache parsed IR in memory during sync
- Don't re-parse unchanged files
- Use file modification timestamps to detect changes

## Future considerations

- **YAML 1.2 strict mode:** Consider enforcing stricter YAML subset
- **Schema evolution:** Plan for breaking changes post-1.0
- **Custom tags:** Currently unsupported, may add if user need arises

---

**Related:**

- [Pre-1.0 Policy](./pre-1.0-policy.md) - Schema iteration policy
- Architecture: `.cursor/rules/architecture.mdc`
- Canonicalization: `packages/schema/src/canonicalize.ts`
