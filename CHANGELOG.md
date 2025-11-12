# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Build order** - Established explicit build stages to resolve dependency graph correctly: schema → {file-utils,markdown-parser,plugin-contracts} → {core,sources,testkit} → {exporters,cli,aligntrue}, fixing race condition in CI
- **Shell command injection** - Replaced template string shell commands with `execFileSync` array arguments in storage manager, fixing CodeQL alert #41 and #40
- **Polynomial ReDoS vulnerabilities** - Fixed unsafe regex patterns in multi-file parser and natural markdown detection for better performance and security

### Added

- **Flexible edit source configuration** (`sync.edit_source`) replaces `two_way` boolean
  - Single file: `"AGENTS.md"` or `.cursor/rules/*.mdc`
  - Multiple files: `["AGENTS.md", ".cursor/rules/*.mdc"]`
  - All agents: `"any_agent_file"`
  - IR only: `".rules.yaml"`
  - Glob pattern support for multi-file agents like Cursor
- **Scope-aware metadata tracking** for multi-file round-trip fidelity
  - `vendor.aligntrue.source_scope` tracks which Cursor file a section originated from
  - `vendor.aligntrue.source_file` stores original file path
  - `vendor.aligntrue.last_modified` timestamp for tracking changes
- **Scope-aware routing** in Cursor exporter
  - Sections automatically routed to correct `.cursor/rules/{scope}.mdc` file based on metadata
  - Enables editing backend.mdc and frontend.mdc separately with proper round-trip sync
- **Optional scope prefixing** for AGENTS.md exporter (`sync.scope_prefixing`)
  - `"off"` (default): No prefixes
  - `"auto"`: Prefix when multiple scopes detected
  - `"always"`: Always prefix non-default scopes
  - Format: `Backend: Security` for sections from backend scope
- **Read-only file markers** in exported files
  - HTML comments warn when files don't match edit_source
  - Shows which files are editable and how to change configuration
  - Prevents accidental edits to auto-generated files
- **Smart edit source recommendations** during `aligntrue init`
  - Priority: Cursor > AGENTS.md > other single-file > any_agent_file
  - Context-aware defaults based on detected agents
  - Clear descriptions of each option's tradeoffs
- **Read-only file edit detection** in sync command
  - Detects when non-editable files have been modified
  - Prompts for action: backup and continue, discard, or cancel
  - Prevents data loss from unexpected overwrites
- Comprehensive emoji usage documentation in documentation rules
  - Explicit prohibition in synced content (AGENTS.md, IR, exports)
  - Allowed in docs site, READMEs, and CLI output
- `detectReadOnlyFileEdits()` function in multi-file-parser
- `matchesEditSource()` helper with glob pattern support using micromatch
- `extractScopeFromPath()` function for scope name extraction
- `recommendEditSource()` function for smart onboarding recommendations
- `AlignTrueVendorMetadata` type definition in schema

### Changed

- **DEPRECATED** `sync.two_way` boolean in favor of `sync.edit_source`
  - Migration: `false` → `".rules.yaml"`, `true` → `"any_agent_file"`
  - Backwards compatible - existing configs still work
- `detectEditedFiles()` now uses glob patterns to check all Cursor scope files
  - Previously only checked `.cursor/rules/aligntrue.mdc` (default scope)
  - Now supports `.cursor/rules/*.mdc` pattern matching
- `mergeFromMultipleFiles()` adds vendor metadata to track section origins
- Cursor exporter groups sections by source_scope for multi-file output
- AGENTS.md exporter optionally prefixes section headings with scope names
- Team-managed section markers changed from emoji (🔒) to text `[TEAM-MANAGED]`
- Documentation rules now explicitly prohibit emojis in all synced content
- Config defaults: Cursor detected → `.cursor/rules/*.mdc`, else → `AGENTS.md`
- Onboarding summaries at end of `aligntrue init` and `aligntrue team enable`
- `aligntrue config summary` command to view current configuration
- Lockfile mode prompt during `aligntrue team enable` (soft/strict)
- Team-managed sections guide in documentation
- Support for `managed` field in config schema for team-managed sections
- `managedSections` parameter in ExportOptions interface
- **Conflict warning system** - Prominent warnings when same section edited in multiple files
  - Shows which files conflicted with timestamps
  - Indicates which version was kept (last-write-wins)
  - Displays conflict summary box at end of sync output
- `--show-conflicts` flag for `aligntrue sync` to see detailed section content from each conflicting file
- **Approval diff preview** - Team leads see changes before approving
  - Shows added/modified/removed sections with line counts
  - Automatic in interactive mode, skip with `--no-preview`
  - Force in CI with `--preview` flag
- Bundle comparison utility (`packages/core/src/team/bundle-diff.ts`) for diff generation
- Improved team mode onboarding with clear next steps and configuration summary
- Enhanced documentation for team-managed sections workflow
- Updated architecture and implementation specs to emphasize team-managed sections
- Updated quickstart guide with team mode setup instructions
- **SyncResult interface** now includes `conflicts` field with file timestamps and winner information
- **SectionConflict interface** enhanced with file mtimes and winner tracking
- Conflict warnings now show file modification times and which version won
- Documentation updated with conflict detection examples and approval diff workflow

### Fixed

- Team mode setup now prompts for lockfile mode instead of defaulting silently
- Config validation now recognizes `managed` field as valid
- Conflict detection no longer silent - warnings are prominent and actionable

### Breaking Changes

- **⚠️ Removed legacy `rules` format** (pre-1.0 schema evolution)
  - AlignTrue now **only** supports section-based packs (`sections` field required in IR)
  - Removed `rules` field from schema and TypeScript types
  - Removed conversion helpers: `getSections()`, `getRules()`, `convertRuleToSection()`, `isSectionBasedPack()`, `isRuleBasedPack()`
  - Removed `AlignRule`, `AlignCheck`, `AlignAutofix` types
  - All exporters now work directly with `pack.sections`
  - Simplified codebase: ~500-800 LOC removed, single format path
  - **Rationale:** No users yet (alpha release), so no migration burden. Premature backward compatibility eliminated.
  - **Migration:** If you have any files with the old `rules:` format, they will fail validation. Convert to natural markdown sections format (see documentation).

### Documentation

- **Clarified two-way sync behavior**
  - Removed misleading auto-pull documentation that promised features not implemented
  - Added clear documentation of actual behavior: last-write-wins merging, no conflict detection, no prompts
  - New guides: "Two-way sync" for practical examples, "Workflows and scenarios" for real use cases
  - Added "How sync actually works" technical reference with complete truth about defaults and behavior
  - Updated architecture and implementation specs to match actual codebase behavior
  - Quickstart updated to clarify edit locations and data flow

### Added

- **Section-level merging for exporters**
  - Exporters now merge IR sections with existing agent files to preserve user-added sections
  - Team sections and personal sections can coexist in the same file
  - Section matching by heading with hash-based change detection
  - Team-managed sections marked with 🔒 icon and HTML comments
  - Merge statistics reported in exporter warnings (preserved/updated counts)
  - Comprehensive tests for section parsing, matching, and merging

- **Two-way sync architecture**
  - Edit any agent file (AGENTS.md, Cursor .mdc), changes sync to all others via IR
  - Section-based detection with last-write-wins strategy
  - Multi-file parser detects edited files based on mtime
  - Automatic merge of changes back to IR before exporting to all agents
  - Config support: `sync.two_way` (default: true)

- **Team-managed content protection**
  - Config schema for `managed.sections` array to designate protected sections
  - Team-managed sections marked with 🔒 icon in exported files
  - HTML comments warn against direct edits to managed content
  - Clear separation between team rules and personal rules

- **Revert command with diff preview**
  - New `aligntrue revert` command for interactive backup restoration
  - Preview changes with colored diff before applying
  - Selective file restoration support
  - Interactive backup selection with metadata display

- **BackupManager enhancements**
  - `listBackupFiles()` method to list files in a specific backup
  - `readBackupFile()` method to read specific files from backups
  - Selective file restore via `files` parameter in `RestoreOptions`
  - Validates requested files exist in backup before restoration

- **Team mode enhancements (implemented)**
  - Lockfile generator now supports section-based packs with fingerprint-based tracking
  - Lockfile validator detects modified, new, and deleted sections
  - Bundle merger handles section-based pack merging and conflict resolution
  - Drift detection works seamlessly with fingerprints and sections
  - Full test coverage for section-based lockfile operations (21 new tests)

- **Example packs migration (implemented)**
  - Migrated all 11 example packs from YAML to natural markdown format
  - Updated `packs.yaml` registry to reference markdown files
  - Example packs now use YAML frontmatter with natural markdown content
  - Improved readability and AI-friendliness of example documentation

- **Natural Markdown Support**
  - Natural markdown sections with YAML frontmatter as primary authoring format
  - Section fingerprinting for stable identity without explicit IDs
  - All 43 exporters support section-based packs
  - Team mode lockfiles track sections via fingerprints
  - Bundle merging handles section-based pack conflicts
  - All 11 example packs use natural markdown format
  - Documentation: Natural Markdown Workflow guide and technical reference

### Fixed

- **Team mode critical fixes:**
  - Fixed `--accept-agent` crash when value is missing (now throws clear error)
  - Fixed error messages referencing non-existent `aligntrue lock` command (now suggests `aligntrue team approve`)
  - Removed "Session 6" debug artifact from team status output
  - Allow list now enforced in both soft and strict modes (soft warns, strict blocks)

- **Git source support in sync command:** Sync now supports git repositories as rule sources
  - Pull rules from remote git repositories with automatic caching
  - Support for multiple sources with automatic bundle merging
  - Cache reuse for faster subsequent syncs
  - Commit SHA tracking in merge info output
  - Example config:
    ```yaml
    sources:
      - type: git
        url: https://github.com/AlignTrue/examples
        path: examples/packs/global.md
    ```

- **Interactive approval workflow:** In strict mode with TTY, sync prompts to approve unapproved bundle hashes
  - Reduces workflow from 5 steps to 2 steps (approve during sync instead of separate command)
  - Auto-adds approved hash to allow list and reminds to commit
  - Non-interactive mode still shows error with manual approval instructions

- **Comprehensive team mode tests:** Added 6 new error handling tests covering flag validation, error messages, and team command validation
- **Evergreen test repository:** Documented https://github.com/AlignTrue/examples as stable test repo for git source integration testing

### Changed

- **Node.js requirement:** Updated from Node 20 to Node 22 across all packages, CI workflows, and documentation
  - Updated `.node-version` file to 22.14.0
  - Changed test pool from `threads` to `forks` for Node 22 compatibility with `process.chdir()`
  - All 13 packages now require Node >=22
- **Improved error messages:** All lockfile validation errors now show correct approval workflow
  - Soft mode: warns about unapproved hash but allows sync to proceed
  - Strict mode: blocks sync and shows clear 3-step approval process
- **Enhanced team status output:** Clarified lockfile mode descriptions (off/soft/strict)

### Changed (Previously)

- **Documentation clarity:** Updated sync and mode terminology to accurately reflect solo vs team mode behavior
  - Clarified that two-way sync with auto-pull is solo mode only (disabled in team mode)
  - Replaced "contributors" with "users" and "team members" (contributors term now reserved for contributing to AlignTrue)
  - Renamed "Solo developer, open source projects" section to "Flexible rules for distributed users"
  - Updated homepage, FAQ, workflows guide, and about page to reflect accurate sync behavior

### Added

- **Alpha banner** on homepage and all docs pages with GitHub link for updates
- **Automated release workflow** using Changesets and GitHub Actions
- Release documentation at `docs/development/release-process.md` and `RELEASING.md`

### Changed (Breaking)

- **IR format changed** from `.aligntrue/rules.md` to `.aligntrue/.rules.yaml` (internal file)
- **Users now edit** `AGENTS.md` or agent-specific files (`.cursor/*.mdc`) instead of rules.md
- **Multi-agent import** now merges all detected agents by default (was single-agent only)
- **Auto-backup enabled** by default (keeps last 5 backups before sync/import)
- **Rule IDs auto-fixed** on import (no more validation failures for non-conforming IDs)

### Added

- **Gemini MD exporter** (`gemini-md`) for Gemini-specific GEMINI.md format (complements gemini-cli AGENTS.md and gemini-config JSON)
- **Hybrid agent detection** during sync with interactive prompts for newly discovered agents
- `aligntrue adapters detect` command to manually check for new agents
- `aligntrue adapters ignore <agent>` command to suppress detection prompts for specific agents
- `detection.auto_enable` config to auto-enable detected agents without prompting (useful for CI)
- `detection.ignored_agents` config array to track agents that should not trigger prompts
- `--no-detect` and `--auto-enable` flags for sync command
- Multi-agent import with automatic merge and duplicate handling
- Auto-fix for rule IDs on import (stores original ID in vendor bag)
- Backup system enabled by default for sync and import operations
- All-agent detection in init flow (was first-match only)
- **Mermaid diagram support** in documentation with AlignTrue brand theming
- **"How it works" visual flow diagram** on homepage showing AGENTS.md → sync → multiple agents
- **Sync behavior sequence diagrams** showing IR→Agent and Agent→IR flows with auto-pull
- **Solo vs team mode architecture comparison diagram** illustrating workflow differences
- **Workflow decision tree diagram** for choosing sync strategy (auto-pull vs manual review)
- **Customization decision flowchart** replacing ASCII art with visual Mermaid diagram

### Fixed

- Fixed cross-platform path handling in docs validation script (Windows backslash support)
- Fixed CSS formatting in homepage stylesheet
- Suppressed known Nextra 4.6.0 + React 19 type incompatibilities (awaiting Nextra 5 release)

### Removed

- Removed catalog concept and catalog source provider
- Deleted archived catalog website (`/.archive/`)
- Removed `type: "catalog"` from config source types
- Removed markdown parsing for IR files (YAML-only now)

### Migration

**For alpha users:**

This is a breaking change. To migrate existing projects:

1. Delete `.aligntrue/rules.md` (if it exists)
2. Run `aligntrue init` to recreate with new structure
3. Your rules will be imported from existing agent files automatically

**New file structure:**

- `.aligntrue/.rules.yaml` - Internal IR (auto-generated, don't edit)
- `AGENTS.md` - Primary user-editable file (created by init)
- `.cursor/*.mdc`, etc. - Edit any agent file, they stay synced

### Documentation

- Updated README quickstart to show AGENTS.md workflow
- Deleted `apps/docs/content/03-concepts/catalog.md`
- Updated all guides to use git imports for external rules
- Clarified that `/examples/packs/` contains local example files only
- Updated Cursor rules to remove catalog references

## [0.1.0-alpha.2] - 2025-10-31

### Added

- 43 exporters supporting 28 agents
- Team mode with lockfiles and drift detection
- Two-way sync (IR ↔ agents)
- Hierarchical scopes for monorepos
- Vendor bags for agent-specific metadata
- Privacy controls with explicit consent
- Git source provider for importing from any repository

### Changed

- Refactored to CLI-first architecture
- Consolidated exporter patterns with ExporterBase
- Improved error messages and validation

## [0.1.0-alpha.1] - 2025-10-25

### Added

- Initial alpha release
- Core schema validation
- Basic CLI commands (init, sync, check)
- Cursor exporter
- Local source provider

[Unreleased]: https://github.com/AlignTrue/aligntrue/compare/v0.1.0-alpha.2...HEAD
[0.1.0-alpha.2]: https://github.com/AlignTrue/aligntrue/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/AlignTrue/aligntrue/releases/tag/v0.1.0-alpha.1
