---
title: Architecture
description: Key architectural concepts and design principles for AlignTrue.
---

# Architecture

Key architectural concepts and design principles for AlignTrue.

## Core principles

1. **Maintainability** – Prefer explicit modules and shallow trees so AI can reason about the code
2. **Determinism** – YAML → Type-safe model → JCS canonical JSON → SHA-256 hashes
3. **Simplicity** – Small, predictable modules; no registries, no plugin magic
4. **Local-first** – All useful flows run offline; cloud augments later
5. **Agent parity** – Exporters preserve semantics and emit fidelity notes when they cannot
6. **Advisory-first** – Validators explain before they block

## Data flow

AlignTrue follows an IR-first (Intermediate Representation) architecture:

```
Source (YAML/Markdown)
  ↓
IR (Intermediate Representation)
  ↓
Canonical JSON (JCS) + SHA-256 Hash
  ↓
Agent Exports (.mdc, AGENTS.md, MCP configs, etc.)
```

### IR-first design

- `.aligntrue/rules` (IR) is the canonical source, not bundles
- Natural markdown sections compile to IR
- All operations work on IR directly
- Canonicalization only at lock/publish boundaries

### Unidirectional sync

- `.aligntrue/rules/*.md` is the single source of truth
- Sync flows from rules → IR → agent files
- All agent files are read-only exports
- No bidirectional sync or conflict resolution needed

## Determinism

### When we canonicalize

We canonicalize any time we compute a content hash so identical inputs yield the
same checksum:

- Rule and section hashing via `computeContentHash` during rule load, sync, and
  exporter content hashing
- Lockfile generation hashes sections, overlays, and plugs for drift detection
- MCP config generation hashes the server map
- Catalog publishing (removed from roadmap) would reuse the same hashing path

We do **not** re-canonicalize whole bundles on every operation—only the inputs
being hashed—to keep normal workflows fast.

### Implementation

- `packages/schema/src/canonicalize.ts` provides JCS canonicalization and hashing
  helpers used across the stack
- `packages/core/src/lockfile/` and `packages/core/src/plugs/hashing.ts` build on
  those helpers for team-mode locks and plug hashes
- Exporters compute `contentHash` with the same canonicalization and return it in
  `ExportResult` (not written into markdown exports)

## Package architecture

### Stable modules (deterministic logic)

Keep these modules consolidated and deterministic:

- `packages/schema/src/canonicalize.ts` – YAML → canonical JSON (JCS)
- `packages/core/src/plugs/hashing.ts` – SHA-256 integrity hashing built on `computeHash` from schema
- `packages/schema/src/validator.ts` – IR validation with Ajv strict mode
- `packages/core/src/config/` – Config parsing and validation
- `packages/core/src/sync/` – Sync engine (rules → IR → agents)
- `packages/core/src/bundle.ts` – Dependency merge + precedence (team mode)
- `packages/core/src/lockfile/` – Lockfile generation with canonical hashing
- `packages/core/src/scope.ts` – Hierarchical scope resolution

### Adaptation layers (agent-specific)

These adapt core logic to specific surfaces:

- `packages/cli/src/commands/*` – CLI command implementations
- `packages/exporters/src/*/exporter.ts` – Agent-specific exports

## Vendor bags

Vendor bags enable lossless round-trips for agent-specific metadata:

- `vendor.<agent>` namespace for agent-specific extensions
- Volatile paths excluded from hashing via `vendor._meta.volatile` (timestamps,
  session IDs, etc.)
- Preserved during sync operations
- Allows agents to store additional metadata without breaking AlignTrue semantics

Example:

```yaml
vendor:
  cursor:
    session_id: "abc123" # Volatile, excluded from hash
    preferences:
      theme: "dark" # Stable, included in hash
  _meta:
    volatile:
      - cursor.session_id
```

## Source precedence and merge

When multiple sources provide rules, first source wins (highest priority):

1. **Local rules** (`.aligntrue/rules/`) - ALWAYS FIRST, ALWAYS WINS
2. First external source listed in config
3. Second external source listed in config
4. ... (in order)

This ensures local customizations always override external sources on conflict.

### External sources

Configured via `sources` array with new `include` syntax:

```yaml
sources:
  - type: git
    include:
      - https://github.com/org/repo # All .md in root
      - https://github.com/org/repo@v2.0.0 # Specific version
      - https://github.com/org/repo/aligns # All .md in directory
      - https://github.com/org/repo/security.md # Single file
```

## Hierarchical scopes

Path-based rules with merge order for monorepos:

1. Root scope (applies everywhere)
2. Directory scopes (applies to subtree)
3. File-level overrides (most specific)

Rules merge with precedence from most specific to least specific.

## Team mode features

### Lockfiles

- Enable with `mode: team` in config
- Generated with `aligntrue sync`
- Pin exact versions and hashes
- Detect drift in CI with `aligntrue check`

### Bundles

- Merge dependencies and rules
- Resolve conflicts with precedence rules
- Generate once, track in git
- Enable reproducible builds

### Drift detection

- Compare current state against lockfile
- Report changes to rules, versions, or hashes
- Fail CI if drift detected (configurable severity)

## Exporters

AlignTrue includes 50 exporters supporting 28+ agents; `scripts/validate-docs-accuracy.mjs` cross-checks manifests in `packages/exporters/src`.

### Categories

1. **MCP config exporters** - JSON configs for Model Context Protocol agents
2. **Agent-specific formats** - Native formats (.mdc, .yml, .json, etc.)
3. **Universal formats** - AGENTS.md for broad compatibility
4. **Dual-output** - Both universal + specific (e.g., Aider)

### Fidelity notes

Each exporter documents what information may be lost when converting from IR:

- Computed by exporter
- Returned in `ExportResult.fidelityNotes`
- Displayed in CLI output during sync
- Help users understand limitations
- Guide decisions about which exporters to use

### Content hash

- Computed deterministically from canonicalized IR sections
- Returned in `ExportResult.contentHash`
- Useful for drift detection and integrity verification
- Not written to markdown exports (files kept clean); MCP JSON includes
  `content_hash`

## AI-maintainable code principles

### 1. Explicit over dynamic

```ts
// Good: Explicit dispatch
switch (target) {
  case "cursor":
    return exportCursor(bundle);
  case "codex":
    return exportCodex(bundle);
}

// Bad: Dynamic lookup
const exporters = { cursor: exportCursor, codex: exportCodex };
return exporters[target](bundle);
```

### 2. Flat over nested

Max depth three. Modules at `packages/*/src/` with minimal nesting.

### 3. Consolidated complexity

Keep deterministic logic together up to ~800 LOC. Split only when boundaries are obvious.

### 4. Clear data flow

Good: CLI command → schema service → exporter  
Bad: CLI → orchestrator → factory → plugin host → exporter

### 5. Deterministic schema validation

Single JSON Schema (2020-12) exported from `packages/schema`. Use Ajv strict mode everywhere.

### 6. Finish refactors

If you start moving logic, finish in the same PR or leave a `_legacy.ts` file with owner + removal date.

## Testing philosophy

- Unit tests for all core logic
- Integration tests for CLI commands
- Golden tests for determinism
- Contract tests for exporters
- No real time, network, or randomness in tests
- Match CI environment exactly (TZ=UTC)

## Workspace organization

This architecture translates to a clean pnpm monorepo:

```
aligntrue/
├── packages/
│   ├── schema/           # IR validation, canonicalization, hashing
│   ├── plugin-contracts/ # Plugin interfaces
│   ├── file-utils/       # Shared utilities
│   ├── core/             # Config, sync engine, bundle/lockfile
│   ├── sources/          # Multi-source pulling (local, git)
│   ├── exporters/        # Agent-specific exports (50 exporters)
│   ├── cli/              # aligntrue/aln CLI
│   ├── testkit/          # Conformance vectors and golden tests
│   └── ui/               # Design system components
├── apps/
│   └── docs/             # Nextra documentation site
├── examples/             # Example configurations
└── scripts/              # Build and setup scripts
```

**Design principles applied to structure:**

- Max depth 3: packages at `packages/*/src/` with minimal nesting
- Stable deterministic logic consolidated in `schema/` and `core/`
- Agent exporters thin and isolated in `exporters/`
- CLI is the top-level surface in Phase 1

## Security considerations

- No outbound network calls in core path
- Telemetry opt-in via env var (off by default)
- Never log secrets or PII
- Never commit real tokens
- Atomic file writes prevent corruption
- Sandbox execution for command runners

## Published packages

All packages are published under the `@aligntrue` scope:

- `@aligntrue/schema` - IR validation and types
- `@aligntrue/plugin-contracts` - Plugin interfaces
- `@aligntrue/file-utils` - Shared utilities
- `@aligntrue/core` - Config and sync engine
- `@aligntrue/sources` - Multi-source pulling
- `@aligntrue/exporters` - Agent exporters
- `@aligntrue/cli` - Command-line tool
- `@aligntrue/testkit` - Test utilities

**Shim package:**

- `aligntrue` - Depends on `@aligntrue/cli` for easy installation

**Install:**

```bash
npm i -g @aligntrue/cli@next   # Alpha
npm i -g aligntrue             # Stable
```

## Developer workflow

### Schema or sections format changes

Update schema + CLI + exporters in the same PR:

1. Extend shared package types (e.g., `packages/schema/src/types.ts`)
2. Update CLI command handlers
3. Update exporters
4. Add contract tests in `schema/tests/`
5. Add integration tests in `cli/tests/`
6. Update docs and CHANGELOG

### Adding new exporters

Create a new exporter in `packages/exporters`:

1. Add exporter implementation with manifest
2. Add contract tests
3. Update `packages/exporters/src/index.ts` to export it
4. Update CLI to include new exporter
5. Add docs explaining the exporter
6. Update CHANGELOG

### Avoiding cloud features

Cloud features stay in the cloud repo, never imported here. Keep this repo focused on:

- Local-first workflows
- Deterministic bundling
- CI validation
- Open-source tooling

## CI gates and quality checks

- **Bundle size:** CLI tarball must stay under 600 KB
- **Align vendoring:** Align files must not be vendored in CLI
- **Schema changes:** IR format changes require version bump + changelog
- **Determinism:** Tests run with `TZ=UTC` to match CI environment
- **Type checking:** Full typecheck across all packages on pre-push
- **Tests:** All tests must pass on all packages
- **Build:** Full production build must succeed

**Testing environment:**

Run tests locally with CI environment variables:

```bash
TZ=UTC pnpm test
```

This ensures determinism matches CI exactly.

## Next steps

- Review [workspace structure](/docs/06-development/workspace)
- Explore [development commands](/docs/06-development/commands)
- Learn [code standards](/docs/06-development/code-standards)
