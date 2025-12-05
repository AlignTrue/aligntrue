---
title: "Features"
description: "Up-to-date feature list: unidirectional sync, lockfile, deterministic exports, multi‑agent support, and more."
---

# Features

**Update criteria:** This page should be updated whenever features are implemented, removed, or significantly changed. It serves as the single source of truth for AlignTrue's current capabilities.

## Core platform

- Natural markdown authoring in `.aligntrue/rules/` directory with optional enabled/disabled field in frontmatter
- Unidirectional sync engine (rules → IR → agents) with first-wins merge precedence
- 50 exporter formats across 28+ AI coding agents (see compatibility matrix)
- MCP server configuration propagation from centralized `config.mcp.servers`
- Lockfiles for team mode (`.aligntrue/lock.json`) to keep builds reproducible
- Drift detection for CI validation
- Hierarchical scopes for monorepos
- Plugs and overlays for safe customization
- Git-based rule sources from any git host (GitHub, GitLab, Bitbucket, self-hosted)
- Export format options (native multi-file or AGENTS.md per agent)
- Per-rule targeting with `export_only_to` and `exclude_from` frontmatter
- Structure-preserving import (recursive scanning of directories, preserves filenames and subdirectories)
- Structure-preserving export (multi-file exporters mirror `.aligntrue/rules/` organization)

## CLI (22 commands)

**Getting started & sync:**

- `init` — 60-second setup with agent auto-detection
- `sync` — Export rules to agents (always backs up first)
- `status` — Show current status, exporters, and sync health

**Validation & diagnostics:**

- `check` — Validate rules and configuration
- `doctor` — Run health checks and verification tests

**Configuration & management:**

- `config` — View or edit configuration
- `exporters` — Manage exporters (list, enable, disable)
- `rules` — List rules and view agent targeting (`--by-agent`, `--json`)
- `scopes` — List configured scopes
- `sources` — Manage multi-file rule organization (list, split)
- `plugs` — Manage plug slots and fills (list, resolve, validate)
- `add` — Add an align source from a URL
- `remove` — Remove an align source from configuration

**Team mode:**

- `team` — Team mode management (enable, disable, status)
- `drift` — Detect drift between lockfile and allowed sources
- `onboard` — Generate developer onboarding checklist

**Safety & customization:**

- `backup` — Create, list, restore, or clean backups
- `revert` — Restore files from backup with preview
- `override` — Manage overlays for fork-safe customization (add, status, diff, remove)
- `privacy` — Privacy and consent management (audit, revoke)
- `migrate` — Schema migration (preview mode)
- `uninstall` — Remove AlignTrue from this project

See [CLI Reference](/docs/04-reference/cli-reference) for complete command documentation.

## Safety & reliability

**Multi-layer safety system:**

- **Mandatory workspace backups** - Full `.aligntrue/` directory and agent files backed up before every sync (cannot be disabled)
- **Individual file backup** - Files backed up to `.aligntrue/.backups/files/` with timestamps before overwriting
- **Section-level backup** - Conflicting sections preserved during merge operations
- **Atomic file operations** - Temp file + rename pattern prevents corruption during writes
- **Easy recovery** - `aligntrue revert` for quick rollback with preview and diff

**Testing & validation:**

- 1700+ deterministic tests with fixed seeds and reproducible execution
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
- 11 curated example aligns
- Agent compatibility matrix

## Core format & architecture

- **Natural markdown sections** - Primary content format, all 50 exporters support it
- **Unidirectional sync** - Edit in `.aligntrue/rules/`, auto-export to all agent formats
- **IR (`.aligntrue/rules`)** - Internal representation, auto-generated from your edits
- **Schema validation** - JSON Schema 2020-12 with Ajv strict mode
- **Canonical JSON (JCS)** - Deterministic hashing for lockfiles and drift detection

## Team mode

- **Lockfile generation** (`.aligntrue/lock.json`) - v2 stores `version` + bundle hash (team rules + team config)
- **Lockfile validation** - Three modes: off, soft (warn), strict (block)
- **Drift detection** - Single category (`lockfile`) comparing current bundle hash vs lockfile; human/JSON/SARIF outputs
- **Team commands** - `team enable`, `team disable`, `team status`
- **Exporter ownership** - Exporters are shared/merged; enabling team mode keeps personal exporters personal by default. Teams can add a shared baseline in `config.team.yaml`.
- **Scope & Storage Model** - Semantic scopes (team, personal, custom) with storage backends (local, repo, remote)
- **Git-native approval** - Uses PR approval for reviewing rule changes
- **Migration wizards** - Interactive flows for solo→team, team→solo, and mode detection on restore
- **Personal remote repositories** - Version-controlled personal rules in private git repositories
- **Enhanced backups** - Auto-backup with action tracking, scope-specific backups, mode detection

See [Team Mode](/docs/03-concepts/team-mode) for complete documentation.

## Exporters (50 formats across 28+ agents)

All exporters support natural markdown sections format with fidelity notes:

- **Cursor** (`.cursor/rules/*.mdc`) - Scope-based files with YAML frontmatter
- **AGENTS.md** - Universal single-file format (used by Claude, Copilot, Aider, Junie, Goose, and others)
- **OpenHands** (`.openhands/microagents/*.md`) - Multi-file microagent format (one file per rule)
- **VS Code MCP** (`.vscode/mcp.json`) - MCP server configuration
- **Windsurf MCP** - MCP configuration for Windsurf
- **Zed Config** - Zed editor configuration
- **Trae AI** - Trae AI configuration
- **Amazon Q** - Amazon Q Developer
- **Kilocode MCP** - Kilocode MCP server
- **OpenCode Config** - OpenCode configuration
- **Root MCP** - Root-level MCP configuration
- Plus 39 more exporters in `packages/exporters/src/`

See [Agent Support](/docs/04-reference/agent-support) for complete compatibility matrix.

## Sync engine

- **Unidirectional sync** - Rules → IR → agents (one-way export)
- **Section-based organization** - Sections matched by heading/content hash
- **Agent detection** - Detect new agents in workspace and prompt to enable
- **Atomic file operations** - Temp file + rename pattern with checksum tracking
- **Dry-run mode** - Preview changes without writing files
- **Per-exporter configuration** - Control ignore file generation and export format per agent
- **.alignignore file support** - Protect specified files from AlignTrue modifications using gitignore-style patterns

See [Sync Behavior](/docs/03-concepts/sync-behavior) for details.

## Customization system

- **Plugs** - Dynamic value slots with validation (slots + fills)
- **Overlays** - Surgical modifications to aligns (set/remove operations)
- **Overlay validation** - Stale selector detection, ambiguous match warnings, size limits
- **Three-way merge** - Merge overlays with base align changes

See [Customization](/docs/02-customization) for complete guides.

## Scope resolution (monorepos)

- **Hierarchical scopes** - Path-based rule organization
- **Include/exclude patterns** - Glob-based file matching with micromatch
- **Scope merging** - Deep merge with configurable order (root → path → local)
- **Scope listing** - `aligntrue scopes` command

See [Scopes](/docs/02-customization/scopes) for details.

## Git sources

- **Git provider** - Pull rules from remote repositories with caching
- **Source validation** - Align integrity checks for external sources
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
- **Lock schema** — `.aligntrue/lock.json` versioned independently for team mode.
- **Exporter contracts** — Each exporter pins its output version. Breaking changes → exporter major version bump.
- **Migrations** — `aligntrue migrate` prints safe transforms and diffs. Requires `--write` to modify.

## Platform support

- **Required:** Node 20+ (LTS)
- **Supported OSes:** macOS, Linux, Windows (first-class support, cross-platform determinism)
- **CI:** Tested on linux:node22, macos:node22, windows:node22
- **Distribution:** npm, pnpm, yarn, bun, npx

## Related documentation

- [Architecture](/docs/06-development/architecture)
- [Security](/docs/security)
- [Customization](/docs/02-customization)
