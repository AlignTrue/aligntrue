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

- `aligntrue.yaml` (IR) is the canonical source, not bundles
- Literate markdown with fenced ```aligntrue blocks compiles to IR
- All operations work on IR directly
- Canonicalization only at lock/publish boundaries

### Two-way sync

- Default: IR → agents (export rules to agent files)
- Optional: agent → IR (pull changes back from agent files)
- `--accept-agent` flag enables explicit pullback
- Auto-pull enabled by default for seamless workflows

## Determinism

### When to canonicalize

**Only canonicalize when determinism is required:**

- **Lockfile generation** (`aligntrue lock` in team mode) - Produce canonical hash for drift detection
- **Catalog publishing** (`aligntrue publish` in Phase 4) - Produce integrity hash for distribution
- **NOT during:** init, sync, export, import, normal file operations

**Why:**

- Solo devs don't need canonicalization overhead for local files
- Team mode only needs determinism for lockfile-based drift detection
- Catalog publishing needs integrity hash at distribution boundary
- Running canonicalization on every operation adds unnecessary cost

### Implementation

- `packages/schema/src/canonicalize.ts` contains JCS canonicalization logic
- `packages/core/src/lockfile.ts` calls canonicalize when generating locks
- Exporters do NOT canonicalize; they work with IR directly
- All hashing uses `packages/schema/src/hashing.ts`

## Package architecture

### Stable modules (deterministic logic)

Keep these modules consolidated and deterministic:

- `packages/schema/src/canonicalize.ts` – YAML → canonical JSON (JCS)
- `packages/schema/src/hashing.ts` – SHA-256 integrity hashing
- `packages/schema/src/validator.ts` – IR validation with Ajv strict mode
- `packages/core/src/config.ts` – Config parsing and validation
- `packages/core/src/sync.ts` – Two-way sync engine (IR ↔ agents)
- `packages/core/src/bundle.ts` – Dependency merge + precedence (team mode)
- `packages/core/src/lockfile.ts` – Lockfile generation with canonical hashing
- `packages/core/src/scope.ts` – Hierarchical scope resolution

### Adaptation layers (agent-specific)

These adapt core logic to specific surfaces:

- `packages/cli/src/commands/*` – CLI command implementations
- `packages/exporters/src/*/exporter.ts` – Agent-specific exports
- `packages/markdown-parser/src/parser.ts` – Markdown parsing

## Vendor bags

Vendor bags enable lossless round-trips for agent-specific metadata:

- `vendor.<agent>` namespace for agent-specific extensions
- `vendor.*.volatile` excluded from hashing (timestamps, session IDs, etc.)
- Preserved during sync operations
- Allows agents to store additional metadata without breaking AlignTrue semantics

Example:

```yaml
vendor:
  cursor:
    session_id: "abc123" # Volatile, excluded from hash
    preferences:
      theme: "dark" # Stable, included in hash
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
- Generated with `aligntrue lock`
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

AlignTrue includes 43 exporters supporting 28+ agents:

### Categories

1. **MCP config exporters** - JSON configs for Model Context Protocol agents
2. **Agent-specific formats** - Native formats (.mdc, .yml, .json, etc.)
3. **Universal formats** - AGENTS.md for broad compatibility
4. **Dual-output** - Both universal + specific (e.g., Aider)

### Fidelity notes

Each exporter documents what information may be lost when converting from IR:

- Stored in exporter metadata
- Written to export file footers
- Help users understand limitations
- Guide decisions about which exporters to use

### Footer format

All exports include:

- Lock hash (if available)
- Exporter version
- Capabilities version
- Loss count (fidelity notes)

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

## Security considerations

- No outbound network calls in core path
- Telemetry opt-in via env var (off by default)
- Never log secrets or PII
- Never commit real tokens
- Atomic file writes prevent corruption
- Sandbox execution for command runners

## Next steps

- Review [workspace structure](/docs/07-development/workspace)
- Explore [development commands](/docs/07-development/commands)
- See [setup guide](/docs/07-development/setup) for installation
