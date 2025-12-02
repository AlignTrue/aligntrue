# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.2] - 2025-12-01

### Changed

- Updated dependencies in `@aligntrue/schema`: `yaml` from 2.8.1 to 2.8.2, `tsx` from 4.20.6 to 4.21.0

## [Unreleased]

### Added

- **Init exporter selection streamlined** - Init now shows 5 most common exporters (AGENTS.md, Cursor, Claude, Windsurf, Cline) plus any detected ones, with message to add 14+ more via `aligntrue exporters`. Fixes multiselect rendering with large exporter list
- **GitHub web UI URL support** - URL parser now handles GitHub web URLs with `/tree/` and `/blob/` paths. Copy URLs directly from GitHub's web interface (e.g., `https://github.com/org/repo/tree/main/aligns`)
- **Selective import UI for init/add/sources detect** - Smart tiered selection interface when importing rules. Single file: auto-import. Small folder: show list + confirm. Large/multiple folders: show summary + folder-level selection
- **Unified backup system with age-based retention** - All backups consolidated under `.aligntrue/.backups/` (snapshots and files). Individual file backups now use `.bak` suffix for clarity and include timestamp
- **`retention_days` config for age-based backup cleanup** - Replace count-based `keep_count` with intuitive age-based retention (default: 30 days, configurable 0-unlimited)
- **`minimum_keep` safety floor for backups** - Ensure critical recent backups are never deleted regardless of age (default: 3). Protects infrequent users from over-cleanup
- **Extended `aligntrue backup cleanup --legacy`** - New command to remove old backup locations (`.aligntrue/overwritten-rules/`, agent-specific `overwritten-files/`) and scattered `.bak` files from pre-unified era
- **Content mode configuration for single-file exports** - New `content_mode` option in sync config to control how single-file exporters (AGENTS.md, CLAUDE.md) handle rule content. Options: `auto` (inline for 1 rule, links for 2+), `inline` (embed all content), `links` (always use markdown links). CLI flag `--content-mode` overrides config. Size warning emitted for inline content exceeding 50KB
- **Structure preservation for rule imports** - Directory structure preserved when importing rules from remote or local sources. Subdirectories maintained during import (e.g., `backend/security.md` stays `backend/security.md` in `.aligntrue/rules/`)
- **Unified source resolver** - Consolidated source handling for local, git, and URL sources. Recursive scanning of directories for `.md` and `.mdc` files during import, with automatic `.mdc` to `.md` format conversion

### Changed

- **Renamed CLI command `adapters` → `exporters`** - Better aligns with user mental model ("exporters" = formats that export to agents). Config field `exporters:` remains unchanged. CLI help moved from "Development commands" to "Basic commands". Old `/adapters` URL redirects to `/exporters`
- **BREAKING: `resolveSource()` from `@aligntrue/core` no longer supports git sources** - Git source resolution moved from `@aligntrue/core` to `@aligntrue/cli` to eliminate the `new Function()` dynamic import that triggered security scanner warnings. Use CLI commands (`aligntrue add`, `aligntrue sync`) for git sources. Core now throws a clear error for git sources, directing users to use CLI
- **Case-insensitive section heading selectors** - Overlay selectors using `sections[heading=...]` now match case-insensitively for better UX. `sections[heading=Security]` matches "security", "SECURITY", or "Security"
- **Agent files included in backups** - Sync and manual backups now include agent export files (AGENTS.md, .cursor/rules/\*.mdc, etc.) based on configured exporters. Ensures complete restore capability
- **New file backup before overwrite** - When syncing to a new agent file that already has content, the original file is backed up before overwriting
- **BREAKING: Plain HTTP/HTTPS URLs no longer supported for remote rules** - Use git repositories instead (GitHub, GitLab, Bitbucket, SSH, self-hosted). Plain URLs lacked directory listing capabilities. Migrate by changing `https://example.com/rules.yaml` to `https://github.com/org/rules` for full git support
- **BREAKING: Backup configuration schema** - `keep_count` deprecated in favor of `retention_days` + `minimum_keep`. Old configs still work (graceful migration); new installs get age-based retention
- **Individual file backup location** - All overwritten file backups now under `.aligntrue/.backups/files/` instead of scattered `overwritten-rules/` and `overwritten-files/` directories
- **Backup filename format** - Individual file backups now include `.bak` suffix (e.g., `AGENTS.2025-11-29T12-30-00.md.bak`) for improved clarity at a glance
- **`sources split` backup mechanism** - Now uses unified backup system instead of inline `AGENTS.md.bak` in project root
- **Backup cleanup algorithm** - Switched from count-based to age-based with safety floor. Auto-cleanup after sync respects `retention_days` and `minimum_keep` from config

### Fixed

- **Rules not loading from dot-directories** - Fixed glob pattern in `loadRulesDirectory` not finding rules in directories starting with a dot (e.g., `.cursor/`). Added `dot: true` option to enable matching files in dot-prefixed directories
- **AGENTS.md and CLAUDE.md not created during sync** - Fixed exporter failing when frontmatter `globs` field is a string instead of array. Now handles both YAML formats correctly
- **Backup files tracked by git** - Init command now creates `.aligntrue/.gitignore` to ignore internal state files (`.backups/`, `.source-rule-hashes.json`, `.cache/`, etc.)
- **Import flow messaging** - Clarified init and add command messaging. Now shows "Found X rules from [source]" before confirmation instead of confusing "Import complete" followed by "Initialize with X rules?" Also improved error messages to include supported source formats with examples and points to https://aligntrue.ai/add-rules
- **Scattered backup locations** - Eliminated fragmented backups across project root (`.bak` files), `.aligntrue/overwritten-rules/`, and agent-specific `overwritten-files/` directories
- **Lockfile EISDIR error** - Fixed team mode lockfile generation failing with EISDIR error when `.aligntrue/rules` is a directory. Now uses `loadIR()` which correctly handles directory-based rules
- **Git import path handling** - Fixed `aligntrue add <url> --path .` failing with "path should be a path.relative()d string" error. Repository root imports now work correctly
- **Plugs UX messaging** - Improved `aligntrue plugs list` output to provide helpful guidance when no slots are defined. Detects `[[plug:key]]` references in rules and suggests how to define corresponding slots

### Security

- **ReDoS vulnerability in starter rule comment stripping** - Fixed polynomial regex in `stripStarterRuleComment()` that could cause exponential backtracking on pathological input. Replaced vulnerable `[^]*?` pattern with bounded negative lookahead `(?:(?!-->)[\s\S])*?` to prevent catastrophic backtracking

### Fixed

- **Release process workspace protocol safety** - Fixed critical bug in `scripts/manual-release.mjs` where `npm publish` was used instead of `pnpm publish`, risking workspace protocol leaks in published packages. Added post-publish validation and updated documentation to reflect actual manual release workflow
- **Windows test timeouts** - Fixed exporter tests hanging on Windows CI by simplifying atomic file write implementation. Replaced complex temp directory creation with same-directory temp files and hidden backup files, eliminating EXDEV (cross-device link) errors and mkdtempSync delays on Windows
- **Sync cleanup detection** - Replaced unreliable `--prune` flag with new `--clean` flag that properly detects and removes all stale exported files (files with no matching source rule), not just content-identical duplicates. Dynamically derives multi-file exporter paths instead of hardcoded mapping

### Added

- **Stale export cleanup (`--clean` flag)** - New `aligntrue sync --clean` flag removes exported files that no longer have a corresponding source rule. Sync automatically warns about stale files when detected and suggests running with `--clean` to remove them
- **OpenHands multi-file support** - OpenHands exporter now writes one markdown file per rule to `.openhands/microagents/` instead of a single file, enabling better microagent organization
- **Junie AGENTS.md support** - Junie exporter now delegates to AGENTS.md format for consistency with other link-based agents
- **Goose AGENTS.md support** - Goose exporter now delegates to AGENTS.md format instead of custom `.goosehints` format
- **Per-exporter ignore file toggle** - New `ignore_file` option in exporter config allows disabling ignore file generation per agent (e.g., `exporters.cursor: {ignore_file: false}`)
- **.alignignore file support** - New `.alignignore` file prevents AlignTrue from editing, deleting, or overwriting specified files using gitignore-style patterns

- **MCP server configuration propagation** - MCP exporters now read from centralized `config.mcp.servers` and propagate to agent-specific MCP files (.vscode/mcp.json, .cursor/mcp.json, .mcp.json, etc.) with deterministic hashing
- **Align manifest system (.align.yaml)** - New manifest format for curated bundles with includes, customizations, and defaults for easy sharing
- **URL source support (type: url)** - Fetch rules directly from HTTP/HTTPS endpoints with ETag caching and offline fallback
- **Align add/remove CLI commands** - New commands to add/remove align sources from configuration (`aligntrue add <url>`, `aligntrue remove <url>`)
- **Manifest loading utilities** - Core functions for loading manifests, applying customizations, parsing align URLs with query parameters
- **enabled field in rule frontmatter** - Non-destructive way to disable rules without deleting them (default: true if not present)
- **Plugs and overlays conventions reference** - New documentation guide with recommended plug keys (test.cmd, docs.url, org.name, etc.) and overlay patterns to improve ecosystem interoperability
- **Example aligns with plugs** - Updated `testing.md` and `typescript.md` with plug slots and overlay hints to demonstrate best practices
- **Conventions guidance for align authors** - New section in creating-aligns guide encouraging use of standard plug keys for better user experience
- **Simplified source configuration with `include` syntax** - New `include` array field allows multiple files per git source without repetition. Format: `https://github.com/org/repo[@ref][/path]` with smart defaults (no path = all .md in root, path ending with `/` = directory, `@ref` = version pin)
- **First-wins merge precedence** - Rules now merge with local rules always highest priority, then external sources in order listed. First source wins on conflict (changed from last-wins for better UX)
- **Sync summary output** - `aligntrue sync` now displays source precedence list showing all included sources and their priority order
- **URL parser for git sources** - New `parseSourceURL()` utility for parsing fully-qualified git URLs with embedded refs and paths
- **Multi-source reliability tests** - Integration tests for first-wins precedence, source ordering, include syntax validation, and add/remove source workflows
- **Managing rule sources guide** - New comprehensive documentation page with examples, troubleshooting, and best practices for external sources
- **Onboarding sources link** - Added "Add external rules" checklist item with link to `aligntrue.ai/sources` in onboard command
- **Source error formatting** - Clear error messages with "did you mean?" suggestions and available files listing for source-related errors

### Changed

- **Plugs API consistency** - Changed plugs resolution result from `guidance` to `content` field to align with canonical schema
- **Bundle merge logic** - Changed from last-wins to first-wins precedence for better predictability and local-first workflow
- **Git sources documentation** - Updated to show new `include` syntax with examples (backward compatible with old `url`/`path` format)
- **Architecture documentation** - Updated to explain first-wins precedence and source priority order
- **Pack terminology to align** - Renamed "pack" concept to "align" throughout codebase and documentation for clarity

### Fixed

- **Git source sync** - Fixed `Unsupported file format` error when syncing from git sources by using temporary bundle file instead of trying to write to `.aligntrue/rules` directory for non-local sources
- **Command coverage test** - Removed non-existent "update" command from test list to prevent CI failure
- **Git source test** - Fixed assertion logic to properly check sync output for completion messages

### Removed (Cleanup of Deprecated Features)

**Cleanup of bidirectional sync artifacts** - Removed dead code and non-functional features left from earlier architecture:

- **Team-managed sections infrastructure** - Config schema, renderers, and tests for marking sections `[TEAM-MANAGED]`
- **Section merger and bidirectional logic** - `file-merger.ts`, `section-matcher.ts` for merging user edits from agent files
- **Scope prefixing option** (`sync.scope_prefixing`) - Unused configuration for scope prefixes in exports
- **Update command and allow list** - Deprecated `aligntrue update check/apply` and `.aligntrue/allow.yaml` infrastructure (use git PR review instead)
- **Section extraction utility** (`extract-rules.ts`) - Dead code for drift detection from agent file edits
- **recommendEditSource function** - Edit source recommendation for bidirectional sync
- **Skipped and placeholder tests** - Removed obsolete test stubs for bidirectional workflows

**Watch mode fix** - Changed default watch files from agent exports (read-only) to `.aligntrue/rules/**/*.md` (source of truth)

**Impact:** ~1000-1500 lines of code removed, simpler codebase, cleaner mental model for unidirectional sync

### BREAKING CHANGES

**Fundamental architectural shift to Ruler-style unidirectional sync**

This release introduces a complete architectural refactor. The complex bidirectional sync system has been replaced with a simple, reliable unidirectional model: `.aligntrue/rules/*.md` files are the single source of truth, with exports flowing outward to agent-specific formats.

**Migration:** Run `aligntrue init` in existing projects to import rules from agent files into `.aligntrue/rules/`. Review and deduplicate imported rules as needed.

- **New canonical IR format:** `.aligntrue/rules/*.md` (markdown with YAML frontmatter) replaces `.aligntrue/.rules.yaml`
- **Removed:** `sync.edit_source` config option and all related configuration
- **Removed:** `sync.auto_pull`, `sync.primary_agent`, `sync.on_conflict`, `sync.workflow_mode`, `sync.show_diff_on_pull` config options
- **Removed:** Agent pullback (`--accept-agent` flag and related logic)
- **Removed:** Edit source switching prompts and logic
- **Removed:** Bidirectional sync capabilities
- **New init behavior:** Automatically scans for and imports existing agent rules into `.aligntrue/rules/`
- **New export format:** Single-file agents (AGENTS.md, CLAUDE.md, etc.) now use links to rule files instead of concatenated content
- **New frontmatter:** Comprehensive schema with export controls (`exclude_from`, `export_only_to`) and agent-specific metadata blocks

**Why this change:**

- Simpler mental model: edit rules in one place, export everywhere
- More reliable: eliminates complex merge strategies and conflict resolution
- Better organization: one rule per file with clear frontmatter
- Export controls: fine-grained control over which rules export to which agents
- Link-based exports: proven to work better than concatenated files

### Added

- **Frontmatter schema:** Comprehensive YAML frontmatter for rule files with selection mechanisms (scope, globs, apply_to) and export controls (exclude_from, export_only_to)
- **Rule file parser/writer:** New utilities in `@aligntrue/core` for loading and saving `.aligntrue/rules/*.md` files
- **Nested directory support:** Auto-detects nested `.aligntrue/rules/` directories and mirrors structure to agent exports
- **Rule import:** `aligntrue init` now scans for existing Cursor, AGENTS.md, CLAUDE.md and other agent files and imports them
- **Starter templates:** If no existing rules found during init, creates practical starter rules (global, typescript, testing, documentation, debugging)
- **Export controls:** `exclude_from` and `export_only_to` frontmatter fields for fine-grained export control
- **Link-based exports:** Single-file agents (AGENTS.md, CLAUDE.md) now contain links to rule files instead of concatenated content

### Removed

- `packages/cli/src/utils/edit-source-content-merger.ts`
- `packages/cli/src/utils/edit-source-agent-mapping.ts`
- `packages/cli/src/utils/edit-source.ts`
- `packages/cli/src/utils/edit-source-helpers.ts`
- `packages/core/src/config/edit-source-patterns.ts`
- `packages/core/src/utils/edit-source-matcher.ts`
- `packages/core/src/sync/agent-pullback.ts`
- All edit source tests

### Fixed

- **CodeQL security alerts** - Fixed insecure temporary file creation (HIGH severity) by using cryptographic randomness for temp directory names and ensuring proper cleanup; fixed shell command injection vulnerability (MEDIUM severity) in test utilities by safely quoting shell arguments
- **Drift detection reliability** - Replaced timestamp-based agent file drift detection with content hash comparison for deterministic, cross-platform reliability. This fixes intermittent CI failures and handles copy/paste workflows correctly.
- **CodeQL alert (useless assignment)** - Removed unused initialization of `exportResults` variable in sync engine
- **Golden repo test flakiness** - Added error handling and debug logging to improve test stability in CI environment
- **Stuck spinner in sync command** - Fixed an issue where the "Resolving sources" spinner continued running during interactive prompts in non-verbose mode
- Confusing pluralization in init completion message - Message now uses singular "agent" when only 1 exporter is configured, plural "agents" for multiple exporters
- Duplicate message when switching edit source - Removed redundant "Edit source updated" message that appeared before merge strategy prompt during `aligntrue sync`
- Confusing UI in merge strategy prompt - Simplified option labels and hints to eliminate double parentheses and improve clarity
- Silent error handling in drift detection - Added debug logging for allow list parsing failures
- Restored test coverage by fixing skipped tests - Updated 5 sync command tests to use current IR schema format
- Test IR format updated - Fixed tests using deprecated `rules` array format to use `sections` format

### Improved

- Config validation enhancements - Added warnings for incompatible mode/lockfile combinations (solo+lockfile or team without lockfile)
- Refactored check command for maintainability - Extracted file size validation into separate helper module
- Added refactoring strategy documentation - Documented incremental refactoring approach for large SyncEngine class
- **API Improvements for Plugin Developers**
  - Added optional `resetState()` method to `ExporterPlugin` interface in `@aligntrue/plugin-contracts`
  - Allows exporters to clear internal state (like warning counters) between sync runs
  - Fully backward compatible (optional method)
  - Cleaned up internal type assertions in core engine

### Changed

- **BREAKING: Simplified Edit Source Switching**
  - When switching edit sources (e.g., AGENTS.md → Cursor), AlignTrue now treats the **new source as the truth** instead of merging content.
  - **New behavior:**
    1. Old source files are backed up to `.aligntrue/overwritten-rules/` and deleted from workspace.
    2. Content from new source replaces the internal rules (IR).
    3. Sync runs immediately to update all exporters with the new rules.
  - **Removed:** `editSourceMergeStrategy` option and prompts (keep-both/keep-new/keep-existing).
  - **Migration:** Users who relied on merging content during a switch can manually recover sections from the backup file.
- **Unified rule loading configuration** - `sync.source_files` option has been **removed**. The `sync.edit_source` option now controls BOTH file monitoring (for edits) AND content loading.
  - Glob patterns in `edit_source` (e.g. `.cursor/rules/*.mdc`) now automatically trigger multi-file rule loading
  - Single file patterns (e.g. `AGENTS.md`) continue to work as single edit sources
  - This eliminates the common configuration error where rules were watched but not loaded
- **Edit source patterns now centralized** - Single source of truth for exporter-to-pattern mappings in `@aligntrue/core/config/edit-source-patterns`
- **Removed IR-only edit source option** - `edit_source: ".rules.yaml"` is no longer supported (use human-friendly `.aligntrue/rules/*.md` instead)
- **Added support for multi-file markdown organization** - New recommended option `edit_source: ".aligntrue/rules/*.md"` for teams
- **Deprecated `sync.two_way` config option** - Use `edit_source` and `centralized` settings instead
- **Updated messaging** - Clarified distinction between IR file (`.aligntrue/.rules.yaml`, canonical) and edit source options
- **Node.js requirement:** Reduced from Node 22 to Node 20 for broader adoption
  - Node 20 LTS supported until April 2026
  - All packages now require Node >=20
  - CI validates both Node 20 and Node 22 compatibility
  - Updated `.node-version` to 20.18.1

### Fixed

- File-system race conditions (TOCTOU) in agent detection and ignore file handling
  - Removed pre-checks before file reads; rely on try/catch for error handling
  - Prevents malicious or concurrent deletion between check and operation
  - Resolves CodeQL alerts #258-262
- Incomplete sanitization of glob patterns in edit source detection
  - Added proper regex escaping for all special characters before glob-to-regex conversion
  - Resolves CodeQL alert #260
- Unused import in eslint.config.js excluded from linting
  - Resolves CodeQL alert #259

### Added

- ESLint rule `no-check-then-operate` to prevent TOCTOU race conditions at development time
- Three new security-focused ESLint rules to catch issues before CodeQL:
  - `no-math-random`: Flags Math.random() in production code (use crypto instead)
  - `no-env-var-in-output`: Flags process.env in console output (prevent leaks)
  - `no-hardcoded-secrets`: Flags suspected API keys, passwords, tokens in strings
- Checksum-based overwrite protection for exported files using `AtomicFileWriter`
- Interactive conflict resolution prompts during sync when files have been manually edited
- `--force` flag now also bypasses file overwrite protection for non-interactive syncs

### Added

- Agent ignore file management to prevent duplicate context when multiple exporters target formats consumable by same agent
- Automatic detection of format conflicts during init and sync
- Support for 12 agent-specific ignore files (Cursor, Aider, Gemini, Crush, Warp, Cline, Goose, Junie, Augment Code, Kiro, KiloCode, Firebase Studio)
- Nested ignore file support for scoped exports in monorepos
- Config options: `sync.auto_manage_ignore_files`, `sync.ignore_file_priority`, `sync.custom_format_priority`
- Documentation: Preventing duplicate rules guide
- Documentation: Comprehensive CI/automation guide with `--yes` and `--non-interactive` flags
- Documentation: Enhanced CLI reference with non-interactive mode examples for GitHub Actions, GitLab CI, Jenkins

## [0.2.2] - 2025-11-19

### Fixed

- Published packages no longer contain workspace protocol in dependencies
- Added ui package to release script to prevent version drift
- Implemented two-layer validation to catch workspace protocol leaks
- Fixed unresolved plugs warning when fills are properly configured in config.yaml

### Changed

- Release script now uses pnpm publish instead of npm publish for automatic workspace protocol rewriting

## [0.2.1] - 2025-11-19

### Changed

- **BREAKING**: Backups are now mandatory and cannot be disabled
- **BREAKING**: Removed `backup.auto_backup` config option (backups always enabled)
- **BREAKING**: Removed `backup.backup_on` config option (all destructive operations backed up)
- **BREAKING**: Removed `sync.backup_on_overwrite` and `sync.backup_extension` (no more inline .bak files)
- Simplified backup config to single `backup.keep_count` setting (min: 10, default: 20, max: 100)
- All backups now consolidated in `.aligntrue/.backups/` with timestamp organization
- Enhanced CLI messaging to emphasize safety best practices (dry-run, revert, restore)
- Backup timestamps now include process ID and sequence number for guaranteed uniqueness during concurrent operations

### Added

- `aligntrue backup cleanup --legacy` command to remove orphaned .bak files from older versions
- Comprehensive safety best practices documentation in guides
- Clear backup creation and restore messages in CLI output
- Validation for keep_count range with actionable error messages
- Plugs: Config-based fills support via `plugs.fills` in config.yaml
- Plugs: `plugs set <slot> <value>` command to configure fills with format validation
- Plugs: `plugs unset <slot>` command to remove fills
- Plugs: Format validation (command, file, url, text) for fill values
- Plugs: Config fills take precedence over IR fills during sync
- Plugs: Enhanced `plugs list` command to show fills from both config and IR with source indication

### Fixed

- Mode switching (solo↔team) now preserves sync workflow settings (auto_pull, workflow_mode, primary_agent, on_conflict)
- Concurrent backup operations now guaranteed unique via process ID and sequence suffix, preventing rare collision scenarios

### Removed

- Inline .bak file creation (replaced by BackupManager snapshots)
- Ability to disable backups (unsafe, confusing to users)

## [0.2.0] - 2025-11-18

### Added

- Workspace protocol validation (`pnpm validate:workspace`) to ensure all internal packages depend on each other via `workspace:*`
- Pre-publish validation script (`pnpm prepublish:check`) that enforces clean git state, matching versions, workspace compliance, and runs build/typecheck/tests before publishing

### Changed

- Renamed the `agents-md` format to `agents` across schema, core, exporters, and CLI
- All `@aligntrue/*` packages now reference each other via `workspace:*` so local development always prefers live workspace builds

### Fixed

- Type resolution in CI now uses local workspace packages instead of stale npm cache artifacts, preventing `TS2322` regressions when format names change

### Removed

- Removed unused v2 error handling system (common-errors-v2.ts, error-formatter-v2.ts)
- Deleted the deprecated `@aligntrue/ui/nextra` theme factory and CLI multi-agent import stub; docs now reference the standard `apps/docs/theme.config.tsx` flow.

### Fixed

- Git source configuration now matches the reorganized `AlignTrue/examples` repository (`aligns/` subdirectory). Added playbook troubleshooting guidance, updated docs, and verified end-to-end via manual sync to prevent "Rules file not found" errors.
- Drift command human-readable output no longer truncates details; summaries now include lockfile path, total findings, and tips for `--json` / `--gates`.
- `aligntrue plugs --help` now shows the subcommand list instead of failing with a circular error, and subcommands respect the standard `--help` flag.
- Invalid flags are now rejected with clear error messages instead of being silently accepted
- Fixed duplicate warning messages when solo mode has team features enabled
- Security: Use secure temp directory for backup files to prevent information disclosure and symlink attacks (CodeQL alert `js/insecure-temporary-file`)
- Security: Bump `apps/docs` `mermaid` dependency to `11.12.1` so DOMPurify is 3.3.0+, avoiding the SAFE_FOR_TEMPLATES mXSS vulnerability that affected versions before 3.2.4
- Documentation accuracy: Corrected Node.js requirement from 20+ to 22+, removed references to unimplemented commands (pull, md lint/compile), updated CLI command count from 27 to 20, fixed IR file path in architecture docs, and aligned performance benchmark documentation with actual measurements
- Golden repository test validation now matches current exporter behavior (content hash computed and returned, not written as footer)
- UI package test timeouts on Windows by increasing Vitest timeout thresholds to 30s for test and hook execution
- Documentation discrepancy: Clarified that exported files (`.mdc`, `AGENTS.md`, etc.) contain clean rule content without footers; content hash and fidelity notes are returned in `ExportResult` and displayed in CLI output instead
- CI test failures due to performance test thresholds and timeouts being too strict. Increased:
  - `--help` performance test thresholds: 800ms → 1200ms avg (Ubuntu), 1000ms → 1500ms max (Ubuntu); 1200ms → 2000ms avg, 1500ms → 2500ms max (Windows)
  - IR loader large file test timeouts: 30s → 120s for 11MB files, 30s → 60s for 2MB files
  - Git strategy detection test timeout: 5s → 15s for git initialization operations

### Added

- **Remote workflow integration tests** - Test personal rules from GitHub repositories
  - Uses AlignTrue/examples repo for deterministic testing
  - Tests remote git source configuration and synchronization
  - Tests merging team and personal rules from remote sources
  - Tests error handling for network failures and missing files
  - Runs in CI only; skip locally in pre-CI for fast feedback loop
  - Tests enabled when `CI` environment variable is set
- **Large rule set performance tests** - Test CLI with realistic large rule sets
  - Tests with 100-150 sections across 10-15 files
  - Monitors memory usage and sync time
  - Validates performance thresholds (<60s sync, <500MB memory)
  - Tests multi-file source performance
  - Runs in CI only; skip locally in pre-CI for fast feedback loop
- **Test fixtures for remote workflow** - Reusable fixtures in examples/remote-test/
  - personal-rules.md: Personal coding preferences (10 sections)
  - large-rules/: Large rule set (10 files, 112 sections total)
  - README.md: Documentation for fixtures and usage
- **Documentation accuracy validation** - Automated validation prevents documentation drift
  - Validates Node.js version requirements match package.json
  - Validates CLI command count matches actual implementation
  - Validates exporter count matches directory count
  - Validates performance threshold claims match test constants
  - Runs in CI and pre-commit hooks
  - Available via `pnpm validate:docs`
- **Turborepo build optimization** - Replaced complex pnpm scripts with Turborepo for faster, cached builds
  - Automatic dependency graph resolution
  - Parallel execution where possible
  - Built-in caching for faster rebuilds
  - Simplified build scripts: `pnpm build`, `pnpm typecheck`, `pnpm test`

- **Git provider integration tests** - Real network tests (gated by `INTEGRATION=1`) that fetch aligns from `https://github.com/AlignTrue/examples` to ensure regression coverage for remote sources and caching.
- **Command comparison guide** - New docs reference (`apps/docs/content/04-reference/command-comparison.md`) and testing playbook updates explaining when to run `check --ci` vs `drift --gates`.

### Changed

- Simplified exporter names by removing the `-md` suffix: `claude-md`, `agents-md`, `aider-md`, `crush-md`, `gemini-md`, `opencode-md`, `roocode-md`, `warp-md`, `windsurf-md`, and `zed-md` are now `claude`, `agents`, `aider`, `crush`, `gemini`, `opencode`, `roocode`, `warp`, `windsurf`, and `zed`. Update `.aligntrue/config.yaml` exporter lists accordingly.
- Adapter UX improvements: `aligntrue adapters` and `aligntrue status` now link to the full supported agent list and the adapter extension guide whenever they suggest enabling new adapters.
- Spinners now respect terminal capabilities via a shared helper: TTY environments keep the animated output, while non-TTY (CI/log capture) falls back to plain text without ANSI sequences.
- CLI TTY detection now lives in `tty-helper.ts`, removing duplicate helpers from `command-utilities.ts`; `team`/`init` commands and `syncFromAgent` have clearer logging and no longer rely on deprecated annotations.
- `aligntrue check --ci` and `aligntrue drift --gates` help text now cross-reference one another, matching the new command comparison guide.
- Documentation and testing resources referencing `AlignTrue/examples` now use `aligns/<name>.md` paths, matching the reorganized public repository structure.
- **Init no longer overwrites existing agent files**
  - Detects all existing supported agent formats and merges them into `.aligntrue/.rules.yaml` during `aligntrue init`
  - Only creates a new `AGENTS.md` starter when no agent files are found (or when the user explicitly asks for one)
  - Prompts for manual import paths when detection misses a markdown or Cursor file, with clear errors if parsing fails
  - Asks the user whether to run `aligntrue sync` immediately after initialization instead of auto-syncing silently

- **Improved CLI user experience** - Enhanced help text and error messages for better discoverability
  - Suppressed confusing "Invalid IR align" warnings during normal sync operations (validation still occurs at parse time and before export)
  - Enhanced `override add` command help with clear examples showing section-based selectors
  - Improved error messages for invalid selectors with concrete examples
  - Added helpful error for `sources add` command directing users to `pull` command
  - Updated `sources` help text to clarify purpose (multi-file organization vs align addition)

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
  - AlignTrue now **only** supports section-based aligns (`sections` field required in IR)
  - Removed `rules` field from schema and TypeScript types
  - Removed conversion helpers: `getSections()`, `getRules()`, `convertRuleToSection()`, `isSectionBasedAlign()`, `isRuleBasedAlign()`
  - Removed `AlignRule`, `AlignCheck`, `AlignAutofix` types
  - All exporters now work directly with `align.sections`
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
  - Lockfile generator now supports section-based aligns with fingerprint-based tracking
  - Lockfile validator detects modified, new, and deleted sections
  - Bundle merger handles section-based align merging and conflict resolution
  - Drift detection works seamlessly with fingerprints and sections
  - Full test coverage for section-based lockfile operations (21 new tests)

- **Example aligns migration (implemented)**
  - Migrated all 11 example aligns from YAML to natural markdown format
  - Updated `aligns.yaml` registry to reference markdown files
  - Example aligns now use YAML frontmatter with natural markdown content
  - Improved readability and AI-friendliness of example documentation

- **Natural Markdown Support**
  - Natural markdown sections with YAML frontmatter as primary authoring format
  - Section fingerprinting for stable identity without explicit IDs
  - All 43 exporters support section-based aligns
  - Team mode lockfiles track sections via fingerprints
  - Bundle merging handles section-based align conflicts
  - All 11 example aligns use natural markdown format
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
        path: aligns/global.md
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

- **Gemini MD exporter** (`gemini`) for Gemini-specific GEMINI.md format (complements gemini-cli AGENTS.md and gemini-config JSON)
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
- Clarified that `/examples/aligns/` contains local example files only
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
