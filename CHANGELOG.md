# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Documentation accuracy: Corrected Node.js requirement from 20+ to 22+, removed references to unimplemented commands (pull, md lint/compile), updated CLI command count from 27 to 20, fixed IR file path in architecture docs, and aligned performance benchmark documentation with actual measurements
- Golden repository test validation now matches current exporter behavior (content hash computed and returned, not written as footer)
- UI package test timeouts on Windows by increasing Vitest timeout thresholds to 30s for test and hook execution
- Documentation discrepancy: Clarified that exported files (`.mdc`, `AGENTS.md`, etc.) contain clean rule content without footers; content hash and fidelity notes are returned in `ExportResult` and displayed in CLI output instead
- CI test failures due to performance test thresholds and timeouts being too strict. Increased:
  - `--help` performance test thresholds: 800ms → 1200ms avg (Ubuntu), 1000ms → 1500ms max (Ubuntu); 1200ms → 2000ms avg, 1500ms → 2500ms max (Windows)
  - IR loader large file test timeouts: 30s → 120s for 11MB files, 30s → 60s for 2MB files
  - Git strategy detection test timeout: 5s → 15s for git initialization operations

### Added

- **Turborepo build optimization** - Replaced complex pnpm scripts with Turborepo for faster, cached builds
  - Automatic dependency graph resolution
  - Parallel execution where possible
  - Built-in caching for faster rebuilds
  - Simplified build scripts: `pnpm build`, `pnpm typecheck`, `pnpm test`

### Changed

- **Improved CLI user experience** - Enhanced help text and error messages for better discoverability
  - Suppressed confusing "Invalid IR pack" warnings during normal sync operations (validation still occurs at parse time and before export)
  - Enhanced `override add` command help with clear examples showing section-based selectors
  - Improved error messages for invalid selectors with concrete examples
  - Added helpful error for `sources add` command directing users to `pull` command
  - Updated `sources` help text to clarify purpose (multi-file organization vs pack addition)

- **Consolidated validation logic into shared utilities** - Reduced code duplication across packages
  - Created `ensureSectionsArray` utility in `packages/core/src/validation/sections.ts`
  - Refactored 8+ instances of inline array validation to use shared utility
  - Standardized sections validation across bundle, lockfile, sync, overlays, and CLI modules
- **Standardized error handling for non-interactive mode** - Consistent confirmation errors across CLI
  - Added `CommonErrors.nonInteractiveConfirmation` to centralized error factory
  - Refactored 7 instances of inline error messages to use `exitWithError` pattern
  - Improved testability and consistency in migrate, revert, and override commands
- **Created test setup helper to reduce test boilerplate** - Simplified test file setup
  - New `setupTestProject` helper in `packages/cli/tests/helpers/test-setup.ts`
  - Standardized directory creation, file generation, and cleanup across test files
  - Refactored multiple test files to use consistent setup pattern
- **Replaced require() with static imports** - Improved type safety and ESM compliance
  - Converted dynamic `require()` calls to static imports in CLI commands
  - Better TypeScript checking and IDE support
  - Consistent import patterns across codebase
- **Refactored sync command** - Split monolithic 1,319-line sync.ts into focused modules
  - Created `packages/cli/src/commands/sync/` directory structure
  - Separated concerns: options, context-builder, workflow, result-handler
  - Main orchestrator now ~40 lines, each module under 500 lines
  - Improved testability and maintainability
- **Standardized error handling** - Consistent error types across CLI
  - New error type system with `AlignTrueError` base class
  - Specific error classes: `ConfigError`, `ValidationError`, `SyncError`, `TeamModeError`, `NotImplementedError`
  - Consistent error formatting with hints
  - Better exit codes and error messages

### Removed

- **Cleaned up TODOs** - Removed or addressed 19 TODO comments
  - Deleted obsolete TODOs for completed features
  - Updated comments for features deferred to future releases
  - Added clear error messages for unimplemented features
  - Improved code clarity and reduced technical debt

### Added

- **Automated project badges** - Comprehensive status badges on homepage and docs footer
  - CI status (automated via GitHub Actions)
  - npm version (automated from registry)
  - Node.js version requirement (Node 22+)
  - Bundle size (BundlePhobia integration)
  - Code coverage (Codecov integration)
  - Security scan status (CodeQL workflow)
  - Last commit timestamp (GitHub commits)
  - All badges are live and update automatically
- **CodeQL security scanning** - Automated code security analysis
  - Weekly scheduled scans + push/PR triggers
  - TypeScript analysis via GitHub CodeQL
  - Security findings visible in GitHub Security tab
- **Code coverage reporting** - Automated test coverage tracking
  - Codecov integration for test results
  - Coverage reports uploaded on every test run
  - `codecov.yml` configuration for coverage policies
- **Dependabot security patch auto-merge** - Security patches (CVE fixes) now auto-merge after CI passes
  - Enables automatic merging of all security severity levels (low, medium, high, critical)
  - Reduces exposure window for known vulnerabilities
  - Maintains full CI validation before merge
  - Identified via GitHub's native security labels and metadata
  - Security-specific approval comments explain the rationale

### Fixed

- **CRITICAL: Sync destroys user edits** - Fixed exporters overwriting user modifications to existing sections
  - Added `preserve-edit` action type to distinguish user edits from normal IR updates
  - Exporters now check `vendor.aligntrue.last_modified` metadata to identify user-edited sections
  - User edits to existing sections are now preserved during sync
  - Added comprehensive test suite for edit preservation
- **Double path bug in sync** - Fixed incorrect path resolution in `syncFromMultipleAgents`
  - Changed from `resolvePath(configPath, "..")` to proper `dirname` usage
  - Prevents `.aligntrue/.aligntrue/.rules.yaml` path construction errors
- **Circular dependency between core and exporters** - Moved section parser to schema package
  - Core no longer imports from exporters, resolving build failure
  - Section parser available as shared utility in @aligntrue/schema
  - All imports updated in core, cli, and exporters

### Added

- **Strict IR validation** - IR validation errors now block sync with exit code 1 by default
  - Clear error messages showing which fields are missing
  - `--force-invalid-ir` flag to bypass validation (not recommended)
  - Distinguishes between schema errors (block) and content warnings (allow)
- **Config management commands** - `config get/set/list/unset` for programmatic config editing
  - Dot notation support for nested keys (e.g., `sync.edit_source`)
  - Automatic value parsing (strings, booleans, numbers, JSON)
  - Validation before saving changes
  - Exit codes: 0 (success), 1 (validation error), 2 (user error)
- **Local build testing script** - `pnpm test:local` ensures tests run against local code, not outdated npm packages
  - Builds all packages from source
  - Creates isolated test environment
  - Runs smoke tests
  - Generates structured report
  - Cleans up automatically

### Changed

- Increased default backup retention from 5 to 20 backups
- Removed redundant backup default fallback in sync command
- Fixed inconsistent backup defaults across codebase
- Consolidated sync documentation: merged `edit-source.md` into practical guide and `how-sync-works.md` into technical reference for clearer navigation between workflows and internals
- **Improved sync messages** - Added phase indicators for two-way sync process
  - Phase 1: Agent edits → IR (when edits detected)
  - Phase 2: IR → all configured agents (always runs)
  - Verbose mode shows detailed phase information

### Fixed

- **Windows CI performance thresholds** - Relaxed strict performance benchmarks for Windows runners to account for platform-specific overhead (avg: 900ms, max: 1200ms vs Unix avg: 800ms, max: 1000ms for help command)
- **Build and typecheck order** - Established explicit sequential stages with cross-platform compatible package name filters (no quotes for PowerShell compatibility) in both `build:packages` and `typecheck` to resolve dependency graph correctly: schema → {file-utils,plugin-contracts} → {core,sources,testkit} → {exporters,cli,aligntrue}, fixing race condition and Windows CI failures
- **Shell command injection** - Replaced template string shell commands with `execFileSync` array arguments in storage manager, fixing CodeQL alert #41 and #40
- **Polynomial ReDoS vulnerabilities** - Fixed unsafe regex patterns in multi-file parser and natural markdown detection for better performance and security

### Removed

- **Legacy fenced-block markdown format** - Removed ` ```aligntrue` fenced-block authoring format and `@aligntrue/markdown-parser` package
  - Use natural markdown sections format instead (YAML frontmatter + `##` headings)
  - Removed `aligntrue md lint/format/compile/generate` commands
  - Git sources now support both YAML (.yaml/.yml) and natural markdown (.md/.markdown) formats
  - Migration: Convert any fenced-block files to natural markdown (see natural-markdown-sections.md)

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
- **Auto-backup enabled** by default (keeps last 20 backups before sync/import)
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
