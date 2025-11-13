---
title: "Features"
description: "Up-to-date feature list: two‑way sync, lockfile, deterministic exports, multi‑agent support, and more."
---

# Features

**Update criteria:** This page should be updated whenever features are implemented, removed, or significantly changed. It serves as the single source of truth for AlignTrue's current capabilities.

## Production ready

### Core platform

- Natural markdown authoring in `AGENTS.md` or agent files (`.cursor/*.mdc`, etc.)
- Two-way sync engine with section-based merging (IR ↔ agents)
- 43 exporters supporting 28+ AI coding agents
- Lockfiles and bundles for team mode (reproducible builds)
- Drift detection for CI validation
- Hierarchical scopes for monorepos
- Plugs and overlays for safe customization

### CLI (27 commands)

**Basic:**

- `init` — 60-second setup with agent auto-detection
- `sync` — Two-way sync with watch mode and dry-run
- `check` — Rule and config validation
- `config` — View/edit configuration
- `watch` — Watch files and auto-sync on changes

**Development:**

- `adapters` — Manage exporters (list, enable, disable)
- `md` — Markdown validation and formatting
- `plugs` — List and validate plugs in sections
- `scopes` — List configured scopes

**Team:**

- `team` — Team mode management (enable, status, approve, list-allowed, remove)
- `pull` — Pull rules from git repository
- `drift` — Detect drift between lockfile and allowed sources
- `link` — Vendor rule packs from git repositories

**Utilities:**

- `backup` — Manage backups (create, list, restore, cleanup)
- `revert` — Restore files from backup with preview
- `privacy` — Privacy settings and consent management
- `telemetry` — Telemetry opt-in/opt-out
- `update` — Check for CLI updates
- `onboard` — Interactive onboarding wizard
- `override` — Manage overrides (add, remove, diff, status)
- `migrate` — Schema migration (preview mode)

See [CLI Reference](/docs/04-reference/cli-reference) for complete command documentation.

### Developer experience

- Fast `--help` (~95ms response time)
- Consistent error messages (what/why/how format)
- TypeScript 5+ strict mode
- 1800+ tests with determinism checks
- Vitest + Playwright for CI
- Automatic per-file backups (configurable, smart defaults)
- Smart .gitignore management (tied to git.mode)
- Enhanced agent detection with caching and validation
- Scope auto-discovery for monorepos
- Ruler migration support (auto-detect and convert)

### Documentation

- Nextra docs site with quickstart, concepts, and reference
- 11 curated example packs
- Agent compatibility matrix

## Core format & architecture

- **Natural markdown sections** - Primary content format, all 43 exporters support it
- **AGENTS.md authoring** - Primary user-editable file with natural markdown syntax
- **IR (`.aligntrue/.rules.yaml`)** - Internal representation, auto-generated from AGENTS.md
- **Schema validation** - JSON Schema 2020-12 with Ajv strict mode
- **Canonical JSON (JCS)** - Deterministic hashing for lockfiles and drift detection

## Team mode (fully implemented)

- **Lockfile generation** (`.aligntrue.lock.json`) - SHA-256 content hashes, reproducible builds
- **Lockfile validation** - Three modes: off, soft (warn), strict (block)
- **Allow lists** (`.aligntrue/allow.yaml`) - Approved sources for team workflows
- **Drift detection** - Compare lockfile vs allowed sources, multiple output formats (human, JSON, SARIF)
- **Bundle merging** - Combine multiple sources with conflict resolution
- **Team commands** - `team enable`, `team status`, `team approve`, `team list-allowed`, `team remove`
- **Scope & Storage Model** - Semantic scopes (team, personal, custom) with storage backends (local, repo, remote)
- **Git-native approval** - Uses PR approval for internal changes, allowlist for external dependencies
- **Migration wizards** - Interactive flows for solo→team, team→solo, and mode detection on restore
- **Personal remote repositories** - Version-controlled personal rules in private git repositories
- **Enhanced backups** - Auto-backup with action tracking, scope-specific backups, mode detection

See [Team Mode](/docs/03-concepts/team-mode) for complete documentation.

## Exporters (43 agents supported)

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

- **Two-way sync** - IR ↔ agents (bidirectional), section-based merging, last-write-wins
- **Section-based merging** - Sections matched by heading/content hash, user sections preserved
- **Team-managed sections** - Protected sections with 🔒 markers and edit warnings
- **Watch mode** - Continuous file watching with configurable debouncing
- **Enhanced backup system** - Auto-backup enabled by default, selective file restoration with diff preview
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

## Schema evolution and versioning

- **Spec version** — Governs IR format. Pre-1.0 schema may evolve freely. Post-1.0 follows SemVer.
- **Lock schema** — `.aligntrue.lock.json` versioned independently for team mode.
- **Exporter contracts** — Each exporter pins its output version. Breaking changes → exporter major version bump.
- **Migrations** — `aligntrue migrate` prints safe transforms and diffs. Requires `--write` to modify.

## Platform support

- **Required:** Node 20+ (LTS)
- **Supported OSes:** macOS, Linux, Windows (first-class support, cross-platform determinism)
- **CI:** Tested on linux:node20, macos:node20, windows:node20
- **Distribution:** npm, pnpm, yarn, bun, npx

## Recently completed (January 2025)

### Storage backend system

- **YAML IR parsing** - RepoStorageBackend now parses `.aligntrue/.rules.yaml` format
- **Remote access validation** - StorageManager tests SSH/HTTPS connectivity before operations
- **Storage exports** - All storage backends properly exported from core package

### Migration wizards

- **detectPersonalRulesInRepo()** - Scans IR and config to find personal rules in main repo
- **applyMigrationActions()** - Applies promote/move/local actions to sections and config
- **getTeamSections()** - Extracts team scope sections from config
- **getPersonalRemote()** - Retrieves personal remote URL from config
- **applySoloMigration()** - Handles keep/delete/separate actions for team→solo migration

### Migrate commands

- **promoteSection()** - Moves section from personal to team scope
- **demoteSection()** - Moves section from team to personal scope
- **makeLocal()** - Changes section storage to local-only
- **migratePersonal()** - Migrates all personal rules to remote storage
- **migrateTeam()** - Migrates all team rules to remote storage

## Not implemented (removed)

These features were designed for the legacy `rules` format and have been removed from the codebase:

### Import functionality

**Status:** Removed entirely

**What was removed:**

- `aligntrue import` command
- Import parsers for AGENTS.md and Cursor .mdc files
- All import-related functions and tests

**Why removed:**

- Users can author AGENTS.md directly in natural markdown
- Import added complexity without clear value for sections-only format
- Parsing structured metadata from agent files doesn't make sense for natural prose

**Current approach:**

- Users write AGENTS.md by hand (natural markdown)
- `aligntrue init` creates starter AGENTS.md template
- Copy/paste from existing agent files if needed

### Checks engine

**Status:** Package removed entirely

**What was removed:**

- Entire `packages/checks/` directory
- 5 check types: file_presence, path_convention, manifest_policy, regex, command_runner
- SARIF/JSON output formatters

**Why removed:**

- Checks required structured `check:` field in rules (not present in sections)
- Natural markdown sections don't have machine-checkable structure
- CI validation works via lockfile drift detection instead

**Current approach:**

- Use `aligntrue drift --gates` for CI validation
- Drift detection validates lockfile integrity and team alignment
- No file-level policy enforcement (sections are guidance, not policies)

### Edit/conflict detection

**Status:** Removed entirely

**What was removed:**

- Field-level conflict detection
- Rule diff calculation
- Conflict resolution UI

**Why removed:**

- Field-level conflict detection doesn't make sense for natural prose
- Solo mode uses last-write-wins (no conflicts)
- Team mode uses lockfile validation (simpler and more reliable)

**Current approach:**

- Solo mode: auto-pull from agents (last-write-wins)
- Team mode: lockfile validation catches drift at pack level
- Manual conflict resolution by editing AGENTS.md directly

## Never planned

### Cloud features

- Hosted sync and analytics
- Organization dashboards
- SSO and approval workflows
- Multi-tenant features

**Status:** Not planned for OSS repo

### Catalog/registry

- Public pack registry
- Pack discovery and ratings
- Centralized pack hosting

**Status:** Not planned, use git sources instead

## Verifying implementation status

```bash
# Check if a feature is implemented
pnpm build  # Should pass if core features work

# Test team mode
aligntrue team enable
aligntrue sync
cat .aligntrue.lock.json

# Test drift detection
aligntrue drift --json

# Test exporters
aligntrue sync --dry-run

# Test plugs
aligntrue plugs

# Test scopes
aligntrue scopes
```

## Launch readiness

**Ready to ship:**

- ✅ Two-way sync with section-based merging
- ✅ Team mode with lockfiles and managed sections
- ✅ 43 exporters with natural markdown sections
- ✅ Watch mode for continuous sync
- ✅ Revert command with diff preview
- ✅ Enhanced backup system with auto-backup enabled
- ✅ Plugs and overlays
- ✅ Git sources and vendoring
- ✅ Scope resolution for monorepos
- ✅ Drift detection for CI
- ✅ Documentation site

**Intentionally not included:**

- Import command (removed - users write AGENTS.md directly)
- Checks engine (removed - use drift detection instead)
- Edit/conflict detection (removed - lockfile validation sufficient)

## Related Documentation

- [Architecture](/docs/08-development/architecture)
- [Security](/docs/07-policies/security)
- [Customization](/docs/02-customization)
