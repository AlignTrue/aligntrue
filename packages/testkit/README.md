# AlignTrue Conformance Testkit v1

Conformance testkit for validating implementations of Align Spec v1. Provides language-agnostic JSON test vectors and a TypeScript runner for the AlignTrue ecosystem.

## Purpose

The testkit ensures that any implementation of Align Spec v1 produces byte-identical outputs for:

- **Canonicalization** - YAML → JSON → JCS (RFC 8785) transformation
- **Hashing** - SHA-256 integrity computation
- **Validation** - Schema and integrity verification
- **Check runners** - Machine-checkable rule execution

## Contents

### Test Vectors (JSON)

Language-agnostic test vectors in `vectors/`:

- `canonicalization.json` - 17 canonicalization edge cases
- `checks/file-presence.json` - 4 file presence check vectors
- `checks/path-convention.json` - 3 path convention check vectors
- `checks/manifest-policy.json` - 3 manifest policy check vectors
- `checks/regex.json` - 5 regex check vectors
- `checks/command-runner.json` - 3 command runner check vectors
- `integration.json` - References to 11 production packs from AlignTrue/aligns

**Total: 40 test vectors**

### Golden Packs (YAML)

Synthetic minimal packs in `golden/` demonstrating specific behaviors:

1. `minimal-valid.aligntrue.yaml` - Absolute minimum valid pack
2. `canonicalization-edge-cases.aligntrue.yaml` - Unicode, floats, nested structures
3. `all-five-check-types.aligntrue.yaml` - One rule of each check type
4. `severity-levels.aligntrue.yaml` - MUST, SHOULD, MAY severities
5. `dependency-chain.aligntrue.yaml` - Pack dependencies

All golden packs include:

- Computed integrity hashes
- Inline comments explaining what they test
- Valid schema structure
- Under 50 lines for clarity

### TypeScript Runner

The `@aligntrue/testkit` package provides:

- `runCanonVectors(vectors, impl)` - Test canonicalization implementation
- `runCheckVectors(vectors, impl)` - Test check runner implementation
- `runGoldenPacks(packs, validator)` - Test pack validation
- `runAllVectors(...)` - Complete conformance suite

## Usage (Internal)

Run the full conformance suite against the AlignTrue implementation:

```bash
pnpm verify
```

Or from the workspace root:

```bash
pnpm --filter @aligntrue/testkit test
```

This validates that our implementation conforms to Align Spec v1.

## Usage (External Implementations)

### 1. Parse JSON Vectors

Read and parse the vector files:

```python
# Python example
import json

with open('vectors/canonicalization.json') as f:
    canon_vectors = json.load(f)

for vector in canon_vectors:
    input_value = vector['input']
    expected_jcs = vector['expected_jcs']
    expected_sha256 = vector['expected_sha256']

    # Test your implementation
    actual_jcs = your_canonicalize(input_value)
    actual_sha256 = your_hash(actual_jcs)

    assert actual_jcs == expected_jcs, f"JCS mismatch: {vector['name']}"
    assert actual_sha256 == expected_sha256, f"Hash mismatch: {vector['name']}"
```

### 2. Canonicalization Vectors

Each vector has:

- `name` - Unique test case name
- `description` - What this tests
- `input` - JSON value to canonicalize
- `expected_jcs` - JCS (RFC 8785) canonical JSON string
- `expected_sha256` - SHA-256 hash (hex) of JCS output

**Contract:** `input → canonicalize() → JCS string → hash() → SHA-256 hex`

### 3. Check Runner Vectors

Each vector has:

- `name` - Unique test case name
- `description` - What this tests
- `check_type` - One of: file_presence, path_convention, manifest_policy, regex, command_runner
- `rule` - Complete Align rule structure
- `file_tree` - Virtual file system (path → content map)
- `expected_findings` - Array of findings (empty if rule passes)
- `allow_exec` - (Optional) Whether command execution is allowed

**Contract:** Apply `rule` to `file_tree` and verify findings match `expected_findings`.

### 4. Golden Packs

Validate complete Align packs:

```python
# Python example
import yaml

with open('golden/minimal-valid.aligntrue.yaml') as f:
    pack_yaml = f.read()

# Your validator should:
# 1. Parse YAML to JSON
# 2. Validate against JSON Schema
# 3. Compute integrity hash
# 4. Verify stored hash matches computed hash

result = your_validate_align(pack_yaml)
assert result.schema_valid
assert result.integrity_valid
```

### 5. Integration Vectors

The `integration.json` file references 11 production packs from the AlignTrue/aligns repository. To use:

1. Clone https://github.com/AlignTrue/aligns
2. Read the pack files at the specified paths
3. Verify your implementation computes matching integrity hashes

## Vector Formats

### Canonicalization Vector

```json
{
  "name": "stable-key-ordering",
  "description": "Verifies that object keys are sorted lexicographically",
  "input": { "z": 1, "a": 2, "m": 3 },
  "expected_jcs": "{\"a\":2,\"m\":3,\"z\":1}",
  "expected_sha256": "ebba85cfdc0a724b6cc327ecc545faeb38b9fe02eca603b430eb872f5cf75370"
}
```

### Check Runner Vector

```json
{
  "name": "passes-when-files-exist",
  "description": "Verifies that check passes when files matching pattern exist",
  "check_type": "file_presence",
  "rule": {
    "id": "test-file-presence",
    "severity": "MUST",
    "check": {
      "type": "file_presence",
      "inputs": {
        "pattern": "**/*.test.ts"
      },
      "evidence": "Missing test file"
    }
  },
  "file_tree": {
    "src/foo.test.ts": "test content",
    "src/bar.test.ts": "test content"
  },
  "expected_findings": []
}
```

### Integration Vector

```json
{
  "id": "packs/base/base-testing",
  "repo": "https://github.com/AlignTrue/aligns",
  "path": "packs/base/base-testing.aligntrue.yaml",
  "expected_integrity": "FETCH_FROM_REPO"
}
```

## Adding Vectors

To add new test vectors:

1. Add the vector to the appropriate JSON file in `vectors/`
2. For canonicalization vectors, compute expected JCS and SHA-256
3. Run `pnpm verify` to ensure it passes
4. Submit a PR with the new vector

New golden packs:

1. Create a new `.aligntrue.yaml` file in `golden/`
2. Use the `packs/testkit/*` namespace for IDs
3. Add inline comments explaining what it tests
4. Run `npx tsx scripts/compute-golden-hashes.ts` to stamp the hash
5. Run `pnpm verify` to ensure it passes

## CI Integration

Add testkit verification to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run conformance testkit
  run: pnpm verify
```

This ensures the implementation stays compliant as the codebase evolves.

## Coverage

The testkit covers:

- **Canonicalization edge cases**: Unicode, floats, nested structures, key ordering, empty values, YAML anchors
- **All 5 check types**: file_presence, path_convention, manifest_policy, regex, command_runner
- **All 3 severity levels**: MUST, SHOULD, MAY
- **Schema validation**: Required fields, pattern matching, type checking
- **Integrity verification**: Hash computation and comparison
- **Dependency chains**: Pack dependencies and resolution

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Troubleshooting

### All canonicalization tests fail

- Verify you're using JCS (RFC 8785), not standard JSON.stringify()
- Check key ordering (lexicographic sort)
- Verify floating point handling (0.0 → 0, preserve precision)

### Hash mismatches

- Ensure you're hashing the JCS string, not the original input
- Use SHA-256 with hex output (lowercase)
- Check for trailing newlines or encoding issues

### Golden pack validation fails

- Verify you're excluding `integrity.value` when computing the hash
- Parse YAML to JSON before canonicalization
- Check that your schema matches `packages/schema/schema/align.schema.json`

### Check vector failures

- Verify you're implementing the FileProvider abstraction correctly
- Check that glob patterns match the spec (minimatch syntax)
- For command_runner, ensure execution is properly gated by `allow_exec`

## License

MIT

## See Also

- [Align Spec v1](../../spec/align-spec-v1.md)
- [packages/schema](../schema/README.md) - JSON Schema and canonicalization
- [packages/checks](../checks/README.md) - Check runner implementation
- [AlignTrue/aligns](https://github.com/AlignTrue/aligns) - Production packs
