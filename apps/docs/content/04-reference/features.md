---
title: "Features"
description: "Up-to-date feature list: two‑way sync, lockfile, deterministic exports, multi‑agent support, and more."
---

# Features

**Update criteria:** This page should be updated whenever features are implemented, removed, or significantly changed. It serves as the single source of truth for AlignTrue's current capabilities.

## Core platform

- Natural markdown authoring in `.aligntrue/rules/` directory
- Unidirectional sync engine (rules → IR → agents)
- 50 exporters supporting 28+ AI coding agents with auto-detection
- Lockfiles and bundles for team mode (reproducible builds)
- Drift detection for CI validation
- Hierarchical scopes for monorepos
- Plugs and overlays for safe customization

## CLI (21 commands)

**Diagnostics:**

- `status` — Show current status, exporters, and sync health
- `doctor` — Run health checks and verification tests

**Basic:**

- `init` — 60-second setup with agent auto-detection
- `sync` — Export rules to agents with watch mode and dry-run
- `check` — Rule and config validation
- `config` — View/edit configuration
- `watch` — Watch files and auto-sync on changes

**Development:**

- `adapters` — Manage exporters (list, enable, disable)
- `plugs` — Manage plugs (audit, resolve, set)
- `scopes` — List configured scopes
- `sources` — Manage multi-file rule organization (list, split)

**Team:**

- `team` — Team mode management (enable, status, approve, list-allowed, remove)
- `drift` — Detect drift between lockfile and allowed sources
- `link` — Vendor rule packs from git repositories
- `onboard` — Interactive onboarding wizard

**Utilities:**

- `backup` — Manage backups (create, list, restore, cleanup)
- `revert` — Restore files from backup with preview
- `override` — Manage overlays (add, remove, diff, status)
- `privacy` — Privacy settings and consent management
- `telemetry` — Telemetry opt-in/opt-out
- `migrate` — Schema migration (preview mode)

See [CLI Reference](/docs/04-reference/cli-reference) for complete command documentation.

## Safety & reliability

**Multi-layer safety system:**

- **Mandatory workspace backups** - Full `.aligntrue/` directory and agent files backed up before every sync (cannot be disabled)
- **Overwritten-rules backup** - Individual files backed up to `.aligntrue/overwritten-rules/` with timestamps before overwriting
- **Section-level backup** - Conflicting sections preserved during merge operations
- **Atomic file operations** - Temp file + rename pattern prevents corruption during writes
- **Easy recovery** - `aligntrue revert` for quick rollback with preview and diff

**Testing & validation:**

- 1800+ deterministic tests with fixed seeds and reproducible execution
- Vitest + Playwright for CI/CD
- JSON Schema 2020-12 validation with Ajv strict mode (all IR and config)
- Canonical JSON (JCS) hashing for byte-identical reproducibility

**Code quality:**

- TypeScript 5+ strict mode with comprehensive type coverage
- Consistent error messages (what/why/how format with actionable fixes)

**Developer experience:**

- Smart .gitignore management (tied to git.mode)
- Enhanced agent detection with caching and validation
- Scope auto-discovery for monorepos
- Ruler migration support (auto-detect and convert)

## Documentation

- Nextra docs site with quickstart, concepts, and reference
- 11 curated example packs
- Agent compatibility matrix

## Core format & architecture

- **Natural markdown sections** - Primary content format, all 50 exporters support it
- **Agent-native editing** - Edit in your detected agent format (Cursor `.mdc`, etc.) or universal `AGENTS.md`
- **IR (`.aligntrue/rules`)** - Internal representation, auto-generated from your edits
- **Schema validation** - JSON Schema 2020-12 with Ajv strict mode
- **Canonical JSON (JCS)** - Deterministic hashing for lockfiles and drift detection

## Team mode

- **Lockfile generation** (`.aligntrue.lock.json`) - SHA-256 content hashes, reproducible builds
- **Lockfile validation** - Three modes: off, soft (warn), strict (block)
- **Drift detection** - Compare lockfile vs allowed sources, multiple output formats (human, JSON, SARIF)
- **Bundle merging** - Combine multiple sources with conflict resolution
- **Team commands** - `team enable`, `team status`, `team approve`, `team list-allowed`, `team remove`
- **Scope & Storage Model** - Semantic scopes (team, personal, custom) with storage backends (local, repo, remote)
- **Git-native approval** - Uses PR approval for internal changes, allowlist for external dependencies
- **Migration wizards** - Interactive flows for solo→team, team→solo, and mode detection on restore
- **Personal remote repositories** - Version-controlled personal rules in private git repositories
- **Enhanced backups** - Auto-backup with action tracking, scope-specific backups, mode detection

See [Team Mode](/docs/03-concepts/team-mode) for complete documentation.

## Exporters (50 exporter formats supporting 28+ agents)

All exporters support natural markdown sections format with fidelity notes:

- **Cursor** (`.cursor/rules/*.mdc`) - Scope-based files with YAML frontmatter
- **AGENTS.md** - Universal single-file format
- **VS Code MCP** (`.vscode/mcp.json`) - MCP server configuration
- **Windsurf MCP** - MCP configuration for Windsurf
- **Zed Config** - Zed editor configuration
- **Junie** - Junie AI assistant
- **Trae AI** - Trae AI configuration
- **Amazon Q** - Amazon Q Developer
- **Kilocode MCP** - Kilocode MCP server
- **OpenCode Config** - OpenCode configuration
- **Root MCP** - Root-level MCP configuration
- Plus 32 more exporters in `packages/exporters/src/`

See [Agent Support](/docs/04-reference/agent-support) for complete compatibility matrix.

## Sync engine

- **Unidirectional sync** - Rules → IR → agents (one-way export)
- **Section-based organization** - Sections matched by heading/content hash
- **Watch mode** - Continuous file watching with configurable debouncing
- **Agent detection** - Detect new agents in workspace and prompt to enable
- **Atomic file operations** - Temp file + rename pattern with checksum tracking
- **Dry-run mode** - Preview changes without writing files

See [Sync Behavior](/docs/03-concepts/sync-behavior) for details.

## Customization system

- **Plugs** - Dynamic value slots with validation (slots + fills)
- **Overlays** - Surgical modifications to packs (set/remove operations)
- **Overlay validation** - Stale selector detection, ambiguous match warnings, size limits
- **Three-way merge** - Merge overlays with base pack changes

See [Customization](/docs/02-customization) for complete guides.

## Scope resolution (monorepos)

- **Hierarchical scopes** - Path-based rule organization
- **Include/exclude patterns** - Glob-based file matching with micromatch
- **Scope merging** - Deep merge with configurable order (root → path → local)
- **Scope listing** - `aligntrue scopes` command

See [Scopes](/docs/02-customization/scopes) for details.

## Git sources

- **Git provider** - Pull rules from remote repositories with caching
- **Vendoring** - Git submodule/subtree support via `aligntrue link`
- **Vendor validation** - Pack integrity checks for vendored sources
- **Privacy consent** - Respects user consent for network operations

See [Git Workflows](/docs/03-concepts/git-workflows) for details.

## Design principles

- **Local first** — Git is the source of truth. All exports are derived and read-only. No cloud required for core workflows.
- **Deterministic** — Identical inputs produce identical bundles, hashes, and exports. Byte-identical outputs for CI.
- **Sections-based** — Natural markdown sections as the IR (not structured rules with metadata). Preserve user edits.
- **Advisory by default** — Rules guide behavior; teams decide enforcement via lockfiles and CI gates.
- **Multi-agent parity** — Preserve semantics across 28+ exporters; emit clear fidelity notes when translation is lossy.
- **OSS and MIT** — Free forever. No vendor lock-in. Community extensible.

## Schema evolution & versioning

- **Spec version** — Governs IR format. Pre-1.0 schema may evolve freely. Post-1.0 follows SemVer.
- **Lock schema** — `.aligntrue.lock.json` versioned independently for team mode.
- **Exporter contracts** — Each exporter pins its output version. Breaking changes → exporter major version bump.
- **Migrations** — `aligntrue migrate` prints safe transforms and diffs. Requires `--write` to modify.

## Platform support

- **Required:** Node 20+ (LTS)
- **Supported OSes:** macOS, Linux, Windows (first-class support, cross-platform determinism)
- **CI:** Tested on linux:node22, macos:node22, windows:node22
- **Distribution:** npm, pnpm, yarn, bun, npx

## Related documentation

- [Architecture](/docs/08-development/architecture)
- [Security](/docs/07-policies/security)
- [Customization](/docs/02-customization)
