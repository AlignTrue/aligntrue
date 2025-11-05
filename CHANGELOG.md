# Changelog

All notable changes to AlignTrue will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Agent-First Authoring (Import Flow Enhancement):** Init command now detects existing agent rule files (.mdc, AGENTS.md, CLAUDE.md, CRUSH.md, WARP.md) with interactive import prompts. Coverage reports show field-level mapping. Use `--import <agent>` flag for non-interactive imports. Workflow mode auto-configures based on import choice.
- **Version Flag:** Added `--version` and `-v` flags to display CLI version. Help text now includes version information hint.
- **Customization Documentation:** New top-level customization section with comprehensive guides for plugs, overlays, and scopes. Includes decision trees, scenario-based examples, and integration patterns.
- **Persona Guides:** Solo developer and team guides with daily workflow scenarios, customization patterns, and best practices.
- **CLI Commands:** Added documentation for `plugs` (audit, resolve, set), `config` (show, edit), `migrate`, and `team status` subcommands.
- **Consolidated Agent Rule:** Created `customization.mdc` agent rule integrating plugs, overlays, and scopes guidance.

### Fixed

- **TypeScript Strictness:** Resolved `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` violations in import flow. Added null checks for indexed record access and conditional spread for optional properties.
- **Template Validation:** Cursor and AGENTS.md starter templates now use valid 3-segment rule IDs. Init command no longer auto-runs sync, preventing validation failures on fresh setup. Import command generates correct single-block markdown format.
- **User Experience:** Init no longer auto-syncs. Sync and import commands show contextual next steps. All error messages include actionable suggestions.
- **CLI Reference:** Removed incorrect `--offline` flag from sync command documentation (only exists on pull command).
- **Docs stability:** Upgraded Next.js in the documentation site to 15.5.3 so Nextra restores the sidebar and generates all `/docs/*` routes without 404s.

### Security

- **Dependency Updates:** Updated esbuild (≥0.25.0, fixes CORS vulnerability), prismjs (≥1.30.0, fixes DOM clobbering), and next.js (15.4.7, fixes authorization bypass and cache confusion).

### Changed

- **CLI UX:** `team enable` supports `--yes` for non-interactive mode. `adapters enable` now processes multiple adapter names. Config files stay minimal in solo mode.
- **Documentation:** Nextra v4.6.0 site at `apps/docs/` with 30+ pages including new customization section (plugs, overlays, scopes), persona guides (solo, team), and enhanced CLI reference.
- **Pre-commit Error Messages:** Git hooks now show actual TypeScript errors inline with common fix patterns. No more "run this command to see errors" - errors display immediately with actionable guidance.
- **Help Text:** Moved `migrate` command from "Coming Soon" to Settings section with policy hint. Help now includes version flag information.
- **Navigation:** Added customization section between getting-started and guides. Updated homepage and next-steps to link to customization features.

---

## Phase 4.5 Complete (Exporter Consolidation)

### Added

- **ExporterBase class:** Single source of truth for exporter patterns (hashing, fidelity notes, file writes, manifest validation). All 43 exporters now extend this base class, eliminating duplicate code.
- **JSON utilities module:** Centralized canonicalization, hashing, and validation patterns. Used across all exporters and core package.

---

## Phase 4 Complete (Catalog Website)

### Added

- **Catalog website:** Discovery page with search, filters, and sorting. Pack detail pages with exporter preview tabs. Analytics tracking (privacy-focused, opt-in). Share button with UTM parameters. SEO infrastructure with OpenGraph cards and JSON-LD structured data.
- **Catalog examples:** 11 curated packs in `catalog/examples/` with registry metadata and namespace ownership management.
- **Build pipeline:** `temp-build-catalog.mjs` generates deterministic catalog JSON for Next.js consumption with ~5 second build time.

### Fixed

- **Abuse control limits:** Pack YAML reduced to 1MB (realistic for ~5,000 rules). Preview limit reduced to 512KB. Early warning at 50% catalog usage.

---

## Phase 3.5 Complete (Overlays & Customization)

### Added

- **Overlays system:** Fork-safe pack customization with deterministic selectors (`rule[id=...]`, array indices, property paths). Set/remove operations with dot-notation support. Conflict detection and safe update mode with `--auto-resolve` strategies.
- **CLI overlay commands:** `aln override add/status/diff/remove` for interactive overlay management. `aln update --safe` for upstream updates with overlay re-application.
- **Triple-hash lockfile:** Tracks `base_hash`, `overlay_hash`, `result_hash` for precise drift categorization. Enables overlay-aware drift detection.

### Documentation

- Comprehensive overlays guide with fork vs overlay vs plug decision tree. Troubleshooting guide for conflict resolution. Golden repo scenarios demonstrating all use cases.

---

## Phase 3 Complete (Team Mode)

### Added

- **Team mode foundation:** `.aligntrue.team.yaml` with severity remapping. `.aligntrue/allow.yaml` for approved sources. Lockfile-based drift detection with `aln drift` command.
- **Git workflows:** `aln pull` for ad-hoc pulling with `--save`, `--sync`, `--dry-run` flags. `aln link` for vendoring packs from git (submodule/subtree detection). Privacy consent system with persistent opt-in.
- **Drift detection:** Categorized drift (upstream, vendorized, severity_remap, overlay). Deterministic conflict detection and safe update mode.
- **CLI commands:** `aln team enable/status`, `aln team approve/list-allowed/remove`, `aln override add/status/diff/remove`, `aln drift --gates/json/sarif`.

### Documentation

- Team mode guide with severity remapping and allow list workflows. Git workflows guide. Drift detection troubleshooting. Auto-update examples for CI/CD.

---

## Phase 2.5 Complete (Plugs)

### Added

- **Plugs system (v1.1):** Stack-agnostic rule authoring with `[[plug:key]]` placeholders. Configurable slots with format validation (command, text, file, url). Required/optional plug support with TODO block generation for unresolved plugs.
- **Dual hashing:** Pre-resolution hash (with placeholders) and post-resolution hash (after filling). Lockfile tracks unresolved plug count.
- **CLI commands:** `aln plugs audit`, `aln plugs resolve`, `aln plugs set <key> <value>`.

---

## Phase 2 Complete (Import & Git)

### Added

- **Import parsers:** Cursor .mdc (71% coverage) and AGENTS.md (71% coverage) extraction to IR with field-level mapping.
- **Git source provider:** Clone, cache with 7-day TTL, provenance tracking. Privacy consent system with offline support and audit trails.
- **Backup & restore system:** `aln backup create/list/restore/cleanup` commands with automatic retention.

---

## Phase 1 Complete (Alpha Release)

### Added

- **CLI-first architecture:** IR-first design with <60 second setup. 43 exporters supporting 28 AI agents (Cursor, Claude Code, GitHub Copilot, Windsurf, Cody, Aider, etc.).
- **IR schema v1:** Vendor bags for lossless round-trips. Hierarchical scopes for monorepos. Two-way sync with conflict resolution.
- **Lockfile system:** SHA-256 deterministic hashing. Canonical JSON (JCS) for consistent outputs across machines.
- **npm release:** Published as @aligntrue/cli with full CLI tooling.

---

## Version history

### [0.1.0-alpha.2] - 2025-10-28

- Phase 1-2 complete with 1149+ tests (100% pass rate)
- Import parsers, git sources, privacy consent, backup/restore
- Full npm publication

### [0.1.0-alpha.1] - 2025-10-25

- Initial alpha release with core IR schema and Cursor exporter

---

## Pre-1.0 Policy

**Breaking changes allowed until 1.0 stable release.**

Migration framework will be added when: 50+ active repositories, 10+ organizations with multiple repos, or breaking change significantly impacts users.

Until then: Optimal design over backwards compatibility.
