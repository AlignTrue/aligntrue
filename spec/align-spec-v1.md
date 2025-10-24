# Align Spec v1

**Version:** 1.0.0  
**Status:** Draft  
**Date:** 2025-10-24

## Overview

The Align Spec defines a machine-checkable YAML format for packaging rules, checks, and guidance that AI agents and CI systems can validate and enforce. Version 1 focuses on determinism, portability, and objective validation.

## Design Principles

1. **Deterministic**: Identical inputs produce byte-identical canonical forms and hashes
2. **Machine-checkable**: Rules include structured checks with defined types and inputs
3. **Portable**: No platform-specific dependencies or implicit state
4. **Human-readable**: Plain YAML with clear field names and inline documentation
5. **Versioned**: Explicit `spec_version` field for forward compatibility

## Top-Level Structure

An Align pack is a YAML document with the following required fields:

```yaml
id: "packs/base/base-testing"
version: "1.0.0"
profile: "align"
spec_version: "1"
summary: "Brief description of this pack"
tags: ["testing", "paved-road"]
deps: []
scope:
  applies_to: ["backend", "frontend"]
rules:
  - id: "rule-1"
    severity: "MUST"
    check: { ... }
integrity:
  algo: "jcs-sha256"
  value: "<computed>"
```

## Field Definitions

### `id` (required)

- **Type:** string
- **Format:** kebab-case, namespaced path
- **Pattern:** `^packs/[a-z0-9-]+(/[a-z0-9-]+)*$`
- **Example:** `"packs/base/base-testing"`
- **Purpose:** Unique identifier for this pack

### `version` (required)

- **Type:** string
- **Format:** Semantic versioning (semver)
- **Pattern:** `^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$`
- **Example:** `"1.0.0"`, `"1.2.3-beta.1"`
- **Purpose:** Pack version for dependency resolution

### `profile` (required)

- **Type:** string
- **Enum:** `"align"`
- **Purpose:** Document type identifier (reserved for future profile types)

### `spec_version` (required)

- **Type:** string
- **Enum:** `"1"`
- **Purpose:** Align Spec version this document conforms to

### `summary` (required)

- **Type:** string
- **Max length:** 200 characters
- **Purpose:** One-line description for catalog display

### `tags` (required)

- **Type:** array of strings
- **Format:** Each tag is kebab-case, lowercase
- **Example:** `["testing", "paved-road", "typescript"]`
- **Purpose:** Categorization and search

### `deps` (required)

- **Type:** array of strings
- **Format:** Each dependency is a pack ID optionally with version constraint
- **Example:** `[]` or `["packs/base/base-global@^1.0.0"]`
- **Purpose:** Dependency declaration for bundle resolution

### `scope` (required)

Object defining where this pack applies:

- **`applies_to`** (required): array of strings (e.g., `["backend"]`, `["frontend"]`, `["*"]`)
- **`excludes`** (optional): array of glob patterns to exclude
- **`includes`** (optional): array of glob patterns to include

Example:

```yaml
scope:
  applies_to: ["backend", "frontend"]
  includes: ["src/**/*.ts"]
  excludes: ["**/*.test.ts", "node_modules/**"]
```

### `rules` (required)

Array of rule objects. Each rule must have:

#### Rule Object

- **`id`** (required): string, unique within the pack, kebab-case
- **`severity`** (required): enum `"MUST" | "SHOULD" | "MAY"`
  - `MUST`: Blocking violation
  - `SHOULD`: Warning
  - `MAY`: Advisory note
- **`check`** (required): check object (see Check Types below)
- **`autofix`** (optional): object with `hint` field describing how to fix

Example:

```yaml
rules:
  - id: "require-tests-for-new-code"
    severity: "MUST"
    check:
      type: "file_presence"
      inputs:
        pattern: "**/*.{spec,test}.{ts,tsx,js}"
        must_exist_for_changed_sources: true
      evidence: "Missing test file for changed source"
    autofix:
      hint: "Scaffold a minimal test next to the source file"
```

### `integrity` (required)

Object holding the canonical hash of the pack content:

- **`algo`** (required): string, must be `"jcs-sha256"`
- **`value`** (required): string, hex-encoded SHA-256 hash of JCS-canonicalized JSON

The hash is computed over the entire document excluding the `integrity.value` field itself.

## Check Types (v1)

Version 1 defines the following check types:

### `file_presence`

Verifies that files matching a pattern exist.

**Inputs:**

- `pattern` (required): glob pattern
- `must_exist_for_changed_sources` (optional): boolean, default `false`

**Evidence:** string template describing the failure

**Example:**

```yaml
check:
  type: "file_presence"
  inputs:
    pattern: "**/*.test.ts"
    must_exist_for_changed_sources: true
  evidence: "Missing test file for changed source"
```

### `path_convention`

Validates that paths follow a naming convention.

**Inputs:**

- `pattern` (required): regex pattern
- `include` (required): array of glob patterns
- `message` (required): string describing the convention

**Evidence:** string template describing the failure

**Example:**

```yaml
check:
  type: "path_convention"
  inputs:
    pattern: "^[a-z0-9-]+$"
    include: ["src/components/**"]
    message: "Component files must use kebab-case"
  evidence: "File name violates path convention"
```

### `manifest_policy`

Validates dependency management files.

**Inputs:**

- `manifest` (required): path to manifest file (e.g., `"package.json"`)
- `lockfile` (required): path to lockfile (e.g., `"pnpm-lock.yaml"`)
- `require_pinned` (optional): boolean, default `true`

**Evidence:** string template describing the failure

**Example:**

```yaml
check:
  type: "manifest_policy"
  inputs:
    manifest: "package.json"
    lockfile: "pnpm-lock.yaml"
    require_pinned: true
  evidence: "New dependency is not pinned in lockfile"
```

### `regex`

Pattern matching against file contents.

**Inputs:**

- `include` (required): array of glob patterns
- `pattern` (required): regex pattern
- `allow` (required): boolean (true = must match, false = must not match)

**Evidence:** string template describing the failure

**Example:**

```yaml
check:
  type: "regex"
  inputs:
    include: ["**/*.test.ts"]
    pattern: "\\bTODO\\b"
    allow: false
  evidence: "TODO present in test file"
```

### `command_runner`

Executes a command and checks exit code.

**Inputs:**

- `command` (required): shell command string
- `working_dir` (optional): working directory, default `.`
- `timeout_ms` (optional): timeout in milliseconds, default 30000
- `expect_exit_code` (optional): expected exit code, default 0

**Evidence:** string template describing the failure

**Example:**

```yaml
check:
  type: "command_runner"
  inputs:
    command: "pnpm exec tsc --noEmit"
    timeout_ms: 60000
    expect_exit_code: 0
  evidence: "Type check failed"
```

## Canonicalization

To ensure deterministic hashes, Align documents must be canonicalized before hashing:

1. Parse YAML to JSON
2. Apply JCS (RFC 8785) canonicalization
3. Compute SHA-256 hash over the canonical bytes
4. Store hex-encoded hash in `integrity.value`

When validating:

1. Read document
2. Extract `integrity.value`
3. Set `integrity.value` to `"<pending>"`
4. Canonicalize and hash
5. Compare computed hash with stored hash

## SARIF Output

Checks that fail must be emitted in SARIF 2.1.0 format for CI and editor integration. Each violation maps to a SARIF result:

- **level**: `error` (MUST), `warning` (SHOULD), `note` (MAY)
- **ruleId**: `{pack_id}/{rule_id}`
- **message.text**: `{rule.check.evidence}`
- **locations**: array of location objects pointing to files/lines

See `docs/sarif-mapping.md` for full spec.

## Extensibility

Future spec versions may add:

- Additional check types
- Conditional rules (based on context)
- Plugs for templating (Phase 2.5)
- Custom check definitions

Version 1 packs will continue to validate against v1 schema.

## JSON Schema

The canonical JSON Schema (draft 2020-12) is published at:

`packages/schema/schema/align.schema.json`

All tooling must validate against this schema before processing.

## Implementation

Reference implementation of canonicalization and validation is provided in the `@aligntrue/schema` package:

- **Canonicalization**: `packages/schema/src/canonicalize.ts`
- **Validation**: `packages/schema/src/validator.ts`
- **API Documentation**: `packages/schema/README.md`

The implementation includes:
- JCS canonicalization via the `canonicalize` npm package (RFC 8785 compliant)
- SHA-256 hashing with Node.js crypto module
- Ajv-based JSON Schema validation in strict mode
- CLI tools for validation and hash computation

## References

- JCS (RFC 8785): https://www.rfc-editor.org/rfc/rfc8785
- SARIF 2.1.0: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
- JSON Schema 2020-12: https://json-schema.org/draft/2020-12/

## Changelog

### v1.0.0 (2025-10-24)

- Initial spec with five check types
- JCS canonicalization and SHA-256 integrity
- SARIF output mapping
- Dependency resolution via `deps` field

