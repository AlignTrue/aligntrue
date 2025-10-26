# Align Spec v1 (CLI-First)

**Version:** 1  
**Status:** Stable (pre-1.0, may iterate based on feedback)  
**Date:** 2025-10-26  
**Replaces:** Never-shipped catalog-first v1 (archived)

---

## Overview

Align Spec v1 is optimized for **solo developers using CLI-first workflows**. It provides a simple, minimal schema for local rule management with opt-in complexity for team and catalog modes.

**Key Design Principles:**
- Solo mode: minimal fields, no integrity required, simple IDs
- Team mode: adds provenance, lockfile support, stricter validation
- Catalog mode: adds distribution metadata (deferred to Phase 4)
- Canonicalization: only at lock/publish boundaries, not load/save
- IR-first: `aligntrue.yaml` is canonical, markdown authoring is optional

---

## Design Principles

1. **Solo-first:** Design for single developer, local rules, minimal ceremony
2. **Progressive complexity:** Team/catalog features are additive, not required
3. **Local-first:** Everything works offline, no network dependencies
4. **Deterministic at boundaries:** Canonical hashing only when generating locks or publishing
5. **Pre-1.0 freedom:** Schema may change without migration tooling until 1.0 stable

---

## Modes

### Solo Mode (Default)

**Use case:** Individual developer, single project, local rules only

**Characteristics:**
- Minimal required fields
- No integrity/canonicalization overhead
- Simple rule IDs (no namespacing required)
- No lockfile or provenance
- Fast iteration, zero ceremony

### Team Mode (Opt-in)

**Use case:** Team collaboration, drift detection, reproducibility

**Characteristics:**
- Adds provenance fields (owner, source, source_sha)
- Generates lockfile with canonical hashes
- Enables bundle merging from multiple sources
- Git-based collaboration
- Stricter validation

**Enable:** `mode: team` in `.aligntrue/config.yaml`

### Catalog Mode (Phase 4)

**Use case:** Public distribution, discovery, verified authors

**Characteristics:**
- Adds distribution metadata (tags, deps, verified_author)
- Required integrity hash
- Pack namespacing for uniqueness
- Publishing workflow with validation gates

**Enable:** Via `aligntrue publish` command

---

## Schema Structure

### Top-Level Fields

```yaml
# Required (all modes)
id: string
version: string
spec_version: "1"
rules: Rule[]

# Optional (solo mode), Required (team/catalog modes)
summary: string          # Short description

# Team mode additions
owner: string           # Who owns these rules
source: string          # Where they came from (git repo, etc.)
source_sha: string      # Commit SHA or content hash

# Catalog mode additions (Phase 4)
tags: string[]          # Categorization
deps: string[]          # Dependencies on other packs
scope:                  # Where pack applies
  applies_to: string[]
  includes: string[]
  excludes: string[]
```

### Solo Mode Minimal Example

```yaml
id: my-project-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: require-tests
    severity: warn
    applies_to: ["src/**/*.ts"]
    guidance: |
      All features must have tests.
      Aim for 80% coverage.
```

**That's it.** No integrity, no profile, no complex namespacing.

### Team Mode Example

```yaml
id: my-company-backend-rules
version: 1.2.0
spec_version: "1"
summary: Backend API rules for MyCompany

# Team mode provenance
owner: my-company/platform-team
source: github.com/mycompany/rules
source_sha: abc123def456...

rules:
  - id: require-tests
    severity: error  # stricter in team mode
    applies_to: ["src/**/*.ts"]
    guidance: |
      All features must have tests.
      Aim for 90% coverage in team mode.
    check:
      type: manifest_policy
      inputs:
        manifest: package.json
        lockfile: pnpm-lock.yaml
    vendor:
      cursor:
        ai_hint: "Suggest test scaffolding with vitest"
        session_id: "xyz"  # volatile, excluded from hash
      _meta:
        volatile: ["cursor.session_id"]
```

**Lockfile generated separately** via `aligntrue lock` command with canonical hash.

### Catalog Mode Example (Phase 4)

```yaml
# Catalog distribution format
id: packs/mycompany/backend-api
version: 1.2.0
spec_version: "1"
summary: Backend API rules for Node.js + TypeScript

tags: ["backend", "api", "typescript", "nodejs"]
deps:
  - packs/base/base-testing@^1.0.0

scope:
  applies_to: ["backend", "api"]
  includes: ["src/**/*.ts"]
  excludes: ["**/*.test.ts", "node_modules/**"]

owner: mycompany/platform-team
source: github.com/mycompany/rules
source_sha: abc123def456...

rules:
  - id: require-tests
    severity: MUST
    # ... rest of rule

# Catalog requires integrity
integrity:
  algo: jcs-sha256
  value: "abc123..."  # computed at publish time
```

---

## Field Definitions

### `id` (required, all modes)

**Type:** string  
**Format:** Flexible based on mode

**Solo mode:** Simple names
- Examples: `my-rules`, `project-standards`, `backend-rules`
- No namespacing required
- Purpose: Local identification only

**Team mode:** Project-scoped names
- Examples: `mycompany-backend`, `platform-api-rules`
- Can use namespacing if helpful: `mycompany/backend-rules`
- Purpose: Team-wide identification

**Catalog mode:** Pack namespacing (Phase 4)
- Pattern: `packs/<org>/<name>`
- Examples: `packs/mycompany/backend-api`, `packs/base/base-testing`
- Purpose: Global uniqueness in catalog

### `version` (required, all modes)

**Type:** string  
**Format:** Semantic versioning
**Pattern:** `^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$`  
**Examples:** `1.0.0`, `1.2.3-beta.1`, `2.0.0+build.123`

**Versioning semantics:**
- MAJOR: Breaking changes to rules or checks
- MINOR: New rules added, non-breaking changes
- PATCH: Documentation or metadata updates

### `spec_version` (required, all modes)

**Type:** string  
**Value:** `"2-preview"` (until 1.0 stable)

**Purpose:** Indicates which Align Spec version this document conforms to

**Preview status:** Schema may change without migration tooling. Migration framework added when we have 50+ active users or 10+ orgs.

### `summary` (optional solo, required team/catalog)

**Type:** string  
**Max length:** 200 characters  
**Purpose:** One-line description for display

**Solo mode:** Optional (rules file self-documents)  
**Team/Catalog mode:** Required (shows in list views)

### `owner` (team/catalog mode)

**Type:** string  
**Format:** `<org>/<team>` or `<username>`  
**Examples:** `mycompany/platform`, `john-smith`

**Purpose:** Identifies who owns and maintains these rules

**When required:**
- Team mode: Required when using provenance tracking
- Catalog mode: Always required
- Solo mode: Optional

### `source` (team/catalog mode)

**Type:** string  
**Format:** Git repository URL or identifier  
**Examples:** `github.com/mycompany/rules`, `gitlab.internal.com/platform/aligns`

**Purpose:** Where these rules came from (for auditing and updates)

**When required:**
- Team mode: Required when rules pulled from remote
- Catalog mode: Always required
- Solo mode: Not used

### `source_sha` (team/catalog mode)

**Type:** string  
**Format:** Git commit SHA or content hash  
**Examples:** `abc123def456...`, `sha256:abc123...`

**Purpose:** Pin exact version for reproducibility

**When required:**
- Team mode: Required when using lockfile
- Catalog mode: Always required
- Solo mode: Not used

### `tags` (catalog mode, Phase 4)

**Type:** array of strings  
**Format:** kebab-case, lowercase  
**Examples:** `["testing", "typescript", "backend"]`

**Purpose:** Categorization and search in catalog

### `deps` (catalog mode, Phase 4)

**Type:** array of strings  
**Format:** Pack ID with optional version constraint  
**Examples:** `["packs/base/base-testing@^1.0.0"]`

**Purpose:** Dependency declaration for bundle resolution

### `scope` (catalog mode, Phase 4)

**Type:** object

**Fields:**
- `applies_to`: string[] - Where pack applies (e.g., `["backend"]`, `["*"]`)
- `includes`: string[] - Glob patterns to include
- `excludes`: string[] - Glob patterns to exclude

**Purpose:** Define where rules apply (for monorepos and scoped catalogs)

### `rules` (required, all modes)

**Type:** array of Rule objects

See "Rule Schema" section below.

### `integrity` (catalog mode only, Phase 4)

**Type:** object

**Fields:**
- `algo`: `"jcs-sha256"` (only supported algorithm)
- `value`: hex-encoded SHA-256 hash

**Purpose:** Verify content integrity for catalog distribution

**When computed:**
- NOT on load/save operations
- ONLY when: generating lockfile (team mode) or publishing to catalog
- Uses JCS (RFC 8785) canonicalization

**Solo mode:** Not present (no overhead)  
**Team mode:** Computed in lockfile, not in IR file  
**Catalog mode:** Required in published pack

---

## Rule Schema

### Rule Object

```yaml
# Required
id: string              # Unique within pack, kebab-case
severity: string        # "error" | "warn" | "info"
applies_to: string[]    # Glob patterns

# Optional
guidance: string        # Markdown-formatted guidance
check: Check            # Machine-checkable validation
autofix: Autofix        # How to fix violations
vendor: object          # Agent-specific metadata
```

### `id` (required)

**Type:** string  
**Format:** kebab-case  
**Pattern:** `^[a-z0-9]+(-[a-z0-9]+)*$`  
**Examples:** `require-tests`, `no-any-type`, `enforce-coverage`

**Unique within pack, not globally unique.**

### `severity` (required)

**Type:** string  
**Enum:** `"error"` | `"warn"` | `"info"`

**Semantics:**
- `error`: Blocking violation (team mode gates)
- `warn`: Warning (should fix)
- `info`: Advisory note (FYI)

**Note:** Changed from v1's `MUST`/`SHOULD`/`MAY` to standard tooling conventions.

### `applies_to` (required)

**Type:** array of strings  
**Format:** Glob patterns  
**Examples:** `["src/**/*.ts"]`, `["**/*.test.ts"]`, `["apps/*/src/**"]`

**Purpose:** Define which files this rule applies to

### `guidance` (optional)

**Type:** string  
**Format:** Markdown  
**Purpose:** Human-readable explanation of the rule

**May include:**
- Why the rule exists
- How to comply
- Examples
- Links to docs

### `check` (optional)

**Type:** Check object

See "Check Types" section in v1 spec (unchanged).

**Check types:**
- `file_presence`
- `path_convention`
- `manifest_policy`
- `regex`
- `command_runner`

### `autofix` (optional)

**Type:** object

**Fields:**
- `hint`: string - Human-readable hint for fixing

**Phase 1:** Only hints, no automated fixes  
**Future:** May add automated fix scripts

### `vendor` (optional)

**Type:** object  
**Purpose:** Agent-specific metadata for lossless round-trips

**Format:**
```yaml
vendor:
  cursor:
    ai_hint: "Suggest test scaffolding"
    session_id: "xyz"
  aider:
    priority: high
  _meta:
    volatile: ["cursor.session_id"]  # excluded from hashing
```

**Rules:**
- Nested under agent name
- `_meta.volatile` lists fields to exclude from canonical hash
- Preserves agent-specific data during sync
- Enables lossless IR ↔ agent round-trips

---

## Canonicalization Strategy

**Key change from v1:** Canonicalization is NOT performed on every operation.

### When Canonicalization Happens

**Team Mode:**
- `aligntrue lock` command → generates `.aligntrue.lock.json` with canonical hash
- Hash computed over canonical IR (JCS RFC 8785)

**Catalog Mode (Phase 4):**
- `aligntrue publish` command → computes integrity hash for catalog

**Never:**
- During load/save of IR files
- During sync to agents
- During import from agents
- During init or check commands

### Why

**Solo mode:** No canonicalization overhead. Rules are simple files.  
**Team mode:** Determinism only where needed (drift detection via lock).  
**Catalog mode:** Integrity only at distribution boundary.

### Algorithm (when used)

1. Parse YAML to JSON
2. Apply JCS (RFC 8785) canonicalization
3. Exclude `vendor.*.volatile` fields
4. Set `integrity.value` to `"<pending>"` if present
5. Compute SHA-256 hash
6. Store hex-encoded hash

---

## Comparison with v1

| Aspect | v1 (Catalog-First) | v2-preview (CLI-First) |
|--------|-------------------|----------------------|
| Primary use case | Catalog distribution | Solo dev local rules |
| ID format | `packs/org/name` required | Simple names for solo, flexible |
| Profile field | Required `profile: "align"` | Removed (vestigial) |
| Integrity | Required in spec | Only in lockfile/catalog |
| Canonicalization | On every operation | Only at lock/publish |
| Severity | `MUST`/`SHOULD`/`MAY` | `error`/`warn`/`info` |
| Provenance | Optional | Required for team/catalog |
| Vendor bags | Not supported | Supported for round-trips |
| Min fields (solo) | 8 required fields | 4 required fields |

---

## Migration from v1

**No migration tooling in preview.**

If you have v1 packs:
1. Update `spec_version: "1"` → `spec_version: "1"`
2. Remove `profile: "align"` field
3. Change severity: `MUST` → `error`, `SHOULD` → `warn`, `MAY` → `info`
4. If solo: simplify ID to non-pack format
5. If solo: remove `integrity` field
6. Add `applies_to` to each rule (was implicit in v1)

**Automated migration:** Will be added when we have 50+ users (Phase 2).

---

## Validation

### Solo Mode Validation

**Required fields:**
- `id`, `version`, `spec_version`, `rules`

**Optional fields:**
- Everything else

**Validation level:** Permissive (allow exploration)

### Team Mode Validation

**Required fields:**
- All solo fields, plus
- `summary`, `owner`, `source`, `source_sha`

**Validation level:** Strict (prevent drift)

### Catalog Mode Validation (Phase 4)

**Required fields:**
- All team fields, plus
- `tags`, `scope`, `integrity`

**Validation level:** Strictest (ensure quality)

---

## File Conventions

### Solo Mode

```
.aligntrue/
├── config.yaml          # mode: solo
├── rules.md             # literate markdown (optional)
└── aligntrue.yaml       # IR (generated from rules.md or direct)
```

### Team Mode

```
.aligntrue/
├── config.yaml          # mode: team
├── rules.md             # literate markdown source
├── aligntrue.yaml       # IR (canonical)
└── .gitignore           # ignore generated files

.aligntrue.lock.json     # lockfile with canonical hashes (committed)
```

### Exports (all modes)

```
.cursor/rules/           # Cursor .mdc files
AGENTS.md                # Universal agent format
.vscode/mcp.json         # MCP config
```

---

## Pre-1.0 Status

**Current:** `spec_version: "1"`

**Breaking changes allowed:** Yes, until 1.0 stable

**Migration policy:** See `docs/pre-1.0-policy.md`

**Migration framework:** Will be added when we have:
- 50+ active repos using AlignTrue, OR
- 10+ organizations, OR
- Planned breaking change that affects users

**Until then:** Iterate fast, ship improvements, prioritize user feedback over backwards compatibility.

---

## References

- [Align Spec v1](./align-spec-v1.md) - Catalog-first design (superseded)
- [Pre-1.0 Policy](../docs/pre-1.0-policy.md) - Breaking change expectations
- [Package Audit](../docs/package-audit.md) - Why v2 redesign was needed
- [JCS (RFC 8785)](https://www.rfc-editor.org/rfc/rfc8785) - Canonicalization algorithm
- [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/) - Check output format

---

## Implementation

**Reference implementation:** `@aligntrue/schema` package (updated for v2-preview)

**Validation:** Ajv JSON Schema validation in strict mode

**CLI commands:**
- `aligntrue init` - Create new v2-preview config
- `aligntrue validate` - Check spec compliance
- `aligntrue lock` - Generate canonical lockfile (team mode)
- `aligntrue publish` - Publish to catalog with integrity (Phase 4)

---

## Changelog

### v2-preview (2025-10-26)

**Added:**
- Solo mode with minimal required fields
- Team mode with provenance tracking
- Vendor bags for lossless agent round-trips
- Progressive complexity (solo → team → catalog)

**Changed:**
- ID format: flexible based on mode (not just `packs/...`)
- Severity: `error`/`warn`/`info` (from `MUST`/`SHOULD`/`MAY`)
- Canonicalization: only at lock/publish boundaries
- Integrity: only in lockfile/catalog, not in IR file

**Removed:**
- `profile` field (vestigial)
- Required integrity in IR
- Forced pack namespacing for local use

**Migration:** No tooling yet. Manual update or wait for 1.0.

---

**Status:** ✅ v2-preview specification complete and ready for implementation

