# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

### Added

- **Solo UX Improvements - Phases 1-3** - Completed 2025-10-28
  - **Agent→IR Parsers** (Phase 1, Step 17):
    - Created Cursor .mdc parser for `.cursor/rules/*.mdc` files
    - Created AGENTS.md parser for universal markdown format
    - Integrated parsers with sync engine for agent→IR import
    - Supports: cursor, copilot, claude-code, aider, agents-md
    - 36 new tests passing (21 parser + 15 import)
  - **Auto-Pull Configuration** (Phase 2):
    - Added `sync` config section with `auto_pull`, `primary_agent`, `on_conflict` fields
    - Solo mode defaults: `auto_pull: true`, `on_conflict: 'accept_agent'`
    - Team mode defaults: `auto_pull: false`, `on_conflict: 'prompt'`
    - Auto-detects `primary_agent` from configured exporters
    - Integrated auto-pull into sync command workflow
  - **Simplified Solo Config** (Phase 3):
    - Made `version` and `mode` fields optional
    - Auto-detect mode from config contents (minimal config → solo mode)
    - Auto-set version to '1' if not specified
    - Added `aligntrue config show` command to display active configuration
    - Added `aligntrue config edit` command to open config in editor
  - **Native Format Starter Templates** (Phase 4):
    - Created Cursor starter template with 5 example rules in native `.mdc` format
    - Created AGENTS.md starter template with 5 example rules in universal format
    - Updated `aligntrue init` to create native format (not YAML) for solo devs
    - Automatically syncs starter template on first run
    - Config reduced to just `exporters` field (2 lines total)
  - **Mode-Specific Conflict Resolution** (Phase 5):
    - Added `shouldUseSoloFastPath()` function to determine fast path eligibility
    - Solo mode skips conflict detection entirely (auto-accepts from primary agent)
    - Team mode retains full conflict detection with interactive resolution
    - Performance improvement: 50-100ms faster sync in solo mode
    - Integrated into sync engine with audit trail logging
  - **File Watcher Documentation** (Phase 6):
    - Created comprehensive file watcher setup guide (`docs/file-watcher-setup.md`)
    - Platform-specific instructions (VS Code, macOS, Linux, Windows)
    - Fastest and most reliable options per platform
    - Background service configuration (launchd, systemd, Task Scheduler)
    - Updated quickstart with auto-sync section
  - **AI_QA Playbook** (Phase 8):
    - Created comprehensive testing playbook (`docs/AI_QA_PLAYBOOK.md`)
    - 8 test scenarios covering solo and team workflows
    - Validation criteria and expected outcomes
    - Maintenance requirements for keeping scenarios current
    - Updated `.cursor/rules/ai_qa_testing.mdc` to reference playbook
  - **Integration Tests** (Phase 9):
    - Created solo workflow integration tests (`packages/cli/tests/integration/solo-workflow.test.ts`)
    - Created agent import integration tests (`packages/cli/tests/integration/agent-import.test.ts`)
    - 22 comprehensive integration tests covering native format workflows
    - Updated golden repository README with solo workflow documentation
    - All integration tests passing (100% pass rate)
  - **Non-Interactive Init** (Perception Test Gap Fix):
    - Added `--non-interactive` / `-y` flag for CI/automation
    - Added `--project-id` and `--exporters` CLI arguments
    - Comprehensive help text with examples
    - Tested and working (creates files, runs sync automatically)
  - All 429 tests passing (351 core + 56 parser + 22 integration, 100% pass rate)
  - Config schema updated with new sync section
  - CLI sync command enhanced with auto-pull logic
  - Zero YAML interaction required for solo developers
  - Complete solo UX transformation: <60s setup, native formats, auto-sync, zero friction
  - Non-interactive mode enables CI/automation workflows

### Documentation

- **Phase 1 Validation Complete** (Stage 3, Step 33) - Completed 2025-10-28
  - Validated all acceptance criteria against completed Steps 1-32
  - Core implementation: 14/18 decisions complete, 4 deferred to Stage 3.5
  - UX enhancements: 4/8 complete, 4 deferred to Stage 3.5
  - All 786 tests passing (100% pass rate: 778 unit + 8 integration)
  - Golden repository demonstrates <60 second setup
  - Windows support validated via CI matrix
  - Documentation complete: quickstart, commands, troubleshooting, extending, sync-behavior
  - Security posture validated: atomic writes, path checks, checksum protection
  - Stage 3.5 deferred features documented with clear implementation triggers
  - Phase 1 acceptance criteria met, ready for alpha release
  - Updated phase1_refactor.mdc with accurate completion tracking
  - Created STEP_33_COMPLETE.md with comprehensive validation summary

### Added

- **Integration Testing + Golden Repository** (Phase 1, Stage 3, Step 32) - Completed 2025-10-28
  - Created golden repository in `examples/golden-repo/` demonstrating <60 second setup
  - Golden repo includes 5 practical rules (testing, code review, docs, security, TypeScript)
  - Three exporter outputs generated in <5 seconds: Cursor .mdc, AGENTS.md, VS Code MCP config
  - Created 8 integration tests (5 workflow + 3 performance) with 100% pass rate
  - Integration tests validate: fresh init, edit→sync, multi-exporter, conflict detection, dry-run
  - Performance tests validate: init <10s, sync <5s, help <100ms
  - Golden repo validation script with 7 automated checks
  - Updated CI workflow to run integration tests and validate golden repo on Linux + Windows
  - Updated `docs/quickstart.md` with "Try the Golden Repository" section
  - All 786 tests passing (100% pass rate: 778 unit + 8 integration)
  - Files created:
    - `examples/golden-repo/.aligntrue/config.yaml` - Solo mode config
    - `examples/golden-repo/.aligntrue/rules.md` - 5 example rules
    - `examples/golden-repo/README.md` - Complete walkthrough
    - `examples/golden-repo/test-golden-repo.sh` - Validation script
    - `packages/cli/tests/integration/golden-repo.test.ts` - 5 workflow tests
    - `packages/cli/tests/integration/performance.test.ts` - 3 benchmark tests
    - `STEP_32_COMPLETE.md` - Detailed completion summary

### Fixed

- **Schema Type Sync** - Added missing `tags` field to AlignRule TypeScript interface
  - Schema (`align.schema.json`) included `tags` but TypeScript interface was missing it
  - Fixed compilation error in `conflict-detector.ts`
  - Rebuilt all packages to resolve IR loading issues

### Documentation

- **Step 31 Skip Decision** (Phase 1, Stage 3) - Completed 2025-10-28
  - Skipped "Convert examples to literate markdown" (Step 31)
  - Original purpose (ship example packs) doesn't apply to CLI-first architecture
  - User education already covered: Step 30 docs (quickstart, commands, troubleshooting, extending, sync-behavior)
  - Starter template provided by `aligntrue init` command
  - Production packs live in AlignTrue/aligns (no duplication needed)
  - Principle: "If we're not clear on the purpose, it's probably not needed"
  - 10k tokens reallocated to Steps 32-33 for golden repo testing and test fixes
  - Decision record: `STEP_31_SKIPPED.md`

- **Core User Documentation** (Phase 1, Stage 3, Step 30) - Completed 2025-10-27
  - Created `docs/quickstart.md` - <60 second solo dev onboarding, zero jargon
  - Created `docs/commands.md` - Consolidated command reference for all 6 CLI commands
  - Created `docs/troubleshooting.md` - Actionable fixes for installation, init, sync, check, and platform issues
  - Created `docs/extending-aligntrue.md` - High-level adapter contribution guide with exporter patterns
  - Created `docs/sync-behavior.md` - Two-way sync contract, conflict resolution, and precedence rules
  - Solo dev focus: clear examples, progressive disclosure, "simple by default, powerful when needed"
  - All 5 files ready for standalone use and future docs site integration (Phase 4)
  - Comprehensive coverage: quickstart, commands, troubleshooting, extending, sync behavior
  - Real terminal output examples throughout documentation
  - Links between docs for easy navigation
  - Step 30 and 30a (adapter contrib + sync behavior docs) complete

### Changed

- **CLI Help and Error Polish** (Phase 1, Stage 3, Step 29) - Completed 2025-10-27
  - Reorganized main help into sections (Basic, Development, Team, Settings)
  - Standardized command help with Basic/Advanced flag grouping
  - Comprehensive error message review across all 6 commands
  - Validated all errors follow what/why/how format with actionable fixes
  - Ensured fast help output (~95ms for --help, well under 1s requirement)
  - Validated exit code consistency (0=ok, 1=validation, 2=system error)
  - Updated CLI README with new help organization examples
  - Professional CLI UX ready for golden repo testing (Step 32)
  - Files updated:
    - `packages/cli/src/index.ts` - Main help with 4 sections
    - `packages/cli/src/commands/sync.ts` - Flag grouping + improved errors
    - `packages/cli/src/commands/check.ts` - Flag grouping + exit codes
    - `packages/cli/src/commands/md.ts` - Flag grouping
    - `packages/cli/README.md` - Quick reference section + flag documentation

### Documentation
- Added `docs/mcp-scope.md` - Clarifies AlignTrue's MCP scope (generates config files, not server declarations)
- Updated `long_term.mdc` - Removed "Full MCP server" from Phase 2, added to deferred features with clear triggers
- Positioned AlignTrue as complementary to Ruler (AlignTrue for rules, Ruler for MCP servers)
- **Privacy-focused network consent** (Phase 2 planning) - 2025-10-27
  - Enhanced `docs/PRIVACY.md` with comprehensive "Network Operations" section
  - Clarifies offline-first approach: zero network calls by default
  - Documents catalog and git sources as explicit opt-in requiring consent
  - Outlines Phase 2 consent flow: pre-flight analysis, first-time prompts, consent storage
  - Added planned `aligntrue privacy audit|revoke` commands for transparency
  - Added `--offline` mode specification for Phase 2
  - Updated `.gitignore` to exclude `.aligntrue/privacy-consent.json` and other local data
  - Updated `long_term.mdc` Phase 2 scope with privacy consent system deliverables
  - Reinforces trust through transparency: developers see and approve what connects where

### Fixed

- **CLI TypeScript Errors** (Phase 1, Stage 3) - Completed 2025-10-27
  - Fixed type errors in `packages/cli/src/commands/check.ts`
    - Config argument parsing with exactOptionalPropertyTypes
    - Schema validation return type handling
    - Lockfile validation type cast
    - Mismatch property names (rule_id, expected_hash, actual_hash)
  - Fixed type errors in `packages/cli/src/commands/sync.ts`
    - Simplified telemetry collection to avoid unavailable variables
    - Removed dependency on alignPack which doesn't exist in sync result
  - All 11 packages now build successfully with zero TypeScript errors
  - CLI commands ready for Stage 3 polish and integration testing

- **Circular Dependency Resolution** (Phase 1, Architecture) - Completed 2025-10-27
  - Created `@aligntrue/plugin-contracts` package for all plugin interface definitions
  - Created `@aligntrue/file-utils` package for shared infrastructure utilities
  - Broke circular dependency between core and exporters packages that was blocking CI builds
  - Established clean architectural layers: schema → plugin-contracts → file-utils → core/exporters
  - Updated 32 exporter implementations with new import paths
  - All core and exporters packages build successfully after refactor
  - Fixes CI build failures on Linux and Windows
  - Unblocks 5 dependabot PRs
  - Scalable foundation for future plugin types (importers, MCP, source providers)
  - Files created:
    - `packages/plugin-contracts/` - ExporterPlugin, ScopedExportRequest, AdapterManifest types
    - `packages/file-utils/` - AtomicFileWriter class and file operation utilities
  - Files modified:
    - `packages/core/package.json` - Replaced @aligntrue/exporters with plugin-contracts and file-utils
    - `packages/core/src/sync/engine.ts` - Import plugin types from plugin-contracts
    - `packages/core/src/scope.ts` - Import ResolvedScope from plugin-contracts
    - `packages/exporters/package.json` - Replaced @aligntrue/core with file-utils and plugin-contracts
    - `packages/exporters/src/types.ts` - Now re-exports from plugin-contracts
    - `packages/exporters/src/registry.ts` - Import types from plugin-contracts
    - `packages/exporters/src/*/index.ts` - All 32 exporters updated to import from new packages

- **Checks Package IR v1 Compatibility** (Phase 1, Tech Debt) - Completed 2025-10-27
  - Updated severity mapping from MUST/SHOULD/MAY to error/warn/info (IR schema v1)
  - Added type guards for optional `check` property on AlignRule
  - Fixed 33 TypeScript build errors across 7 source files
  - All 5 check runners updated (command-runner, file-presence, manifest-policy, path-convention, regex)
  - SARIF emitter defensive against missing check properties
  - Updated 47 test cases to use new severity values
  - Fixes CI build failures on both Linux and Windows
  - Unblocks 5 dependabot PRs
  - Files modified:
    - `packages/checks/src/types.ts` - Updated severity type and added hasCheck guard
    - `packages/checks/src/engine.ts` - Added type guard before runCheck
    - `packages/checks/src/runners/*.ts` - Updated all 5 runners
    - `packages/checks/src/sarif.ts` - Updated severity mapping function
    - `packages/checks/tests/*.ts` - Updated test fixtures
  - All 47 tests passing (100% pass rate)

### Added

- **Windows CI Matrix** (Phase 1, Stage 3, Step 28) - Completed 2025-10-27
  - GitHub Actions matrix with ubuntu-latest and windows-latest runners
  - Cross-platform validation: 165+ tests passing on both Linux and Windows
  - Validates path normalization works correctly across platforms
  - Confirms deterministic behavior (same inputs → same outputs on all platforms)
  - Node 20 on both platforms
  - Comprehensive workspace testing (all packages: schema, markdown-parser, core, sources, exporters, cli, checks, testkit)
  - Parallel matrix jobs with OS-specific pnpm cache keys
  - Fast-fail disabled to see results on both platforms
  - Files created:
    - `.github/workflows/ci.yml` (comprehensive CI workflow, ~70 lines)
  - Removed: `.github/workflows/validate-aligns.yml` (superseded by ci.yml)
  - Decision 14 in architecture-decisions.md now validated

- **CLI Check Command** (Phase 1, Stage 3, Step 27a) - Completed 2025-10-27
  - `aligntrue check --ci` for automated validation in CI/CD pipelines
  - Schema validation: loads and validates `.aligntrue/rules.md` against JSON Schema
  - Lockfile validation: validates `.aligntrue.lock.json` in team mode (strict mode)
  - Non-interactive mode with clear exit codes (0=pass, 1=fail, 2=error)
  - Comprehensive error messages with actionable fixes
  - Pre-commit hook snippet with manual and Husky installation instructions
  - GitHub Actions workflow example for automated validation
  - GitLab CI, CircleCI, and Jenkins integration examples
  - Troubleshooting guide for common CI issues
  - 15 comprehensive tests covering all validation scenarios (100% pass rate)
  - Complete CI integration documentation in CLI README (~125 lines)
  - Files created:
    - `packages/cli/src/commands/check.ts` (220 lines)
    - `packages/cli/tests/commands/check.test.ts` (15 tests, 397 lines)
  - Updated CLI entry point with check command routing
  - Total CLI tests: 97 passing (82 existing + 15 new check tests)

- **Catalog Source Provider** (Phase 1, Stage 3, Step 27) - Completed 2025-10-27
  - Fetch Align packs from AlignTrue/aligns GitHub repository
  - Two-step fetch: catalog/index.json validation, then pack YAML
  - Local cache in `.aligntrue/.cache/catalog/` with indefinite TTL
  - Offline fallback: uses cache when network unavailable
  - Force refresh support with `forceRefresh: true` option
  - Security: pack ID validation prevents path traversal
  - Atomic cache writes prevent partial state
  - 33 comprehensive tests with mocked network calls (100% pass rate)
  - Config: `type: catalog, id: "packs/base/base-global"`
  - GitHub raw URLs: `https://raw.githubusercontent.com/AlignTrue/aligns/main/`
  - Cache behavior:
    - First fetch: downloads from GitHub, caches locally
    - Subsequent fetches: returns from cache (no network call)
    - Force refresh: bypasses cache, downloads fresh
    - Network error: falls back to cache with warning
  - Pack ID format: `packs/<category>/<pack-name>`
  - Examples: `packs/base/base-global`, `packs/stacks/nextjs-app-router`
  - Files created:
    - `packages/sources/src/providers/catalog.ts` (466 lines)
    - `packages/sources/tests/catalog-provider.test.ts` (835 lines, 33 tests)
  - Updated: `packages/sources/src/providers/index.ts` with factory
  - Updated: `packages/sources/README.md` with comprehensive documentation
  - Updated: `packages/core/README.md` with catalog source examples
  - Total sources package tests: ~34 passing (1 existing + 33 new catalog tests)

- **Telemetry Infrastructure** (Phase 1, Stage 3, Step 26) - Completed 2025-10-27
  - Event collection with anonymous UUID generation
  - Records: command_name, export_target, align_hashes_used
  - Never collects: file paths, repo names, code, PII
  - Local storage: `.aligntrue/telemetry-events.json` (Phase 1 local-only)
  - Automatic rotation after 1000 events (keeps most recent)
  - Privacy validation: rejects events with paths, code snippets, or suspicious content
  - Integration across all 6 CLI commands (init, sync, team, telemetry, scopes, md)
  - Telemetry errors do not fail commands (wrapped in try-catch)
  - 34 comprehensive tests in core package (UUID, events, rotation, privacy)
  - Phase 2+ TODO: Add opt-in sending flow with explicit consent and clear privacy messaging
  - Privacy guarantees documented in `docs/PRIVACY.md`
  - CLI README updated with telemetry section and examples
  - Files created:
    - `packages/core/src/telemetry/collector.ts` (234 lines)
    - `packages/core/tests/telemetry/collector.test.ts` (326 lines, 34 tests)
    - `docs/PRIVACY.md` (comprehensive privacy documentation)
  - Updated: All CLI commands now record telemetry events when enabled
  - Total tests: 116 passing (34 core telemetry + 82 CLI)
  - Fixed: exactOptionalPropertyTypes TypeScript errors in lockfile and telemetry modules

- **CLI Team/Telemetry/Scopes Commands** (Phase 1, Stage 3, Step 25) - Completed 2025-10-27
  - Three new command groups for team mode, telemetry, and scopes management
  - **Team Enable Command:**
    - `aligntrue team enable` - Upgrade project to team mode
    - Updates config.yaml to set mode: team
    - Enables lockfile and bundle modules automatically
    - Interactive confirmation with @clack/prompts
    - Idempotent (handles already-team-mode gracefully)
    - Shows next steps for lockfile generation
    - 11 comprehensive tests (100% pass rate)
  - **Telemetry Commands:**
    - `aligntrue telemetry on|off|status` - Manage telemetry settings
    - Simple JSON file storage (.aligntrue/telemetry.json)
    - Opt-in only (disabled by default)
    - Atomic writes for safety (temp+rename pattern)
    - Clear messaging about what we collect (commands, targets, hashes)
    - Clear messaging about what we never collect (code, paths, PII)
    - 16 comprehensive tests (100% pass rate)
  - **Scopes Command:**
    - `aligntrue scopes` - List configured scopes from config
    - Displays path, include/exclude patterns, rulesets
    - Fast read-only operation (no file scanning)
    - Helpful message when no scopes configured
    - 11 comprehensive tests (100% pass rate)
  - Files created:
    - `packages/cli/src/commands/team.ts` (123 lines)
    - `packages/cli/src/commands/telemetry.ts` (137 lines)
    - `packages/cli/src/commands/scopes.ts` (92 lines)
    - `packages/cli/tests/commands/team.test.ts` (213 lines, 11 tests)
    - `packages/cli/tests/commands/telemetry.test.ts` (182 lines, 16 tests)
    - `packages/cli/tests/commands/scopes.test.ts` (216 lines, 11 tests)
  - Updated CLI entry point with command routing
  - Comprehensive CLI README documentation with examples and output samples
  - Total CLI tests: 82 passing (24 init + 20 sync + 16 telemetry + 11 scopes + 11 team)

- **CLI Sync Command** (Phase 1, Stage 3, Step 23) - Completed 2025-10-27
  - Full `aligntrue sync` command with IR→agent sync
  - Flags: --dry-run (preview), --accept-agent (pullback with mock data), --force (non-interactive), --config (custom path)
  - Dynamic exporter loading from registry using discoverAdapters and loadAdapter
  - Progress indicators with @clack/prompts spinners (loading, syncing, writing)
  - Comprehensive error messages with actionable fixes
  - Lockfile validation in team mode (soft/strict enforcement)
  - Audit trail output showing all sync operations (visible in --dry-run)
  - Config validation: checks for .aligntrue/config.yaml, suggests init if missing
  - Source validation: checks for rules file, shows path and config tips
  - Exporter discovery: finds all manifests, loads handlers, registers with engine
  - Mock data warning: --accept-agent shows clear notice about Step 17 implementation
  - Success output: shows files written, warnings, conflicts with counts
  - Failure handling: lockfile drift suggestions, exporter config tips
  - 23 comprehensive tests (100% coverage)
  - Files created:
    - `packages/cli/src/commands/sync.ts` (main command, 297 lines)
    - `packages/cli/tests/commands/sync.test.ts` (23 tests, 397 lines)
  - Integration with existing SyncEngine (Steps 9+14), config parser (Step 8), exporters (Steps 10-13)
  - CLI README fully updated with sync documentation, examples, troubleshooting

- **CLI Init Command** (Phase 1, Stage 3, Step 22) - Completed 2025-10-27
  - Full `aligntrue init` command with intelligent context detection
  - Auto-detection of all 28 AI coding agents by checking output paths
  - Smart agent selection: auto-enable if ≤3 detected, prompt if >3
  - Comprehensive starter template with 5 educational example rules
  - Context-aware flows: fresh-start, import-cursor, import-agents, already-initialized
  - Team join scenario with helpful guidance instead of bare error
  - Interactive prompts with @clack/prompts for beautiful CLI UX
  - Auto-sync prompt at end: "Run sync now? [Y/n]"
  - Solo mode default configuration generation
  - 24 comprehensive tests covering all scenarios (100% pass rate)
  - Complete CLI README documentation with examples and scenarios
  - Migrated from `prompts` to `@clack/prompts` across all packages
  - Updated conflict resolution prompts to use Clack API
  - Agent detection utility: `detect-agents.ts` with 28 agent patterns
  - Context detection utility: `detect-context.ts` for smart flow selection
  - Starter template generator: 5 rules showing all major features
  - Catalog integration TODO added for Phase 2+
  - Terminology: uses "rules" in all user-facing output
  - Files created:
    - `packages/cli/src/commands/init.ts` (main command, 200 lines)
    - `packages/cli/src/utils/detect-agents.ts` (agent detection, 147 lines)
    - `packages/cli/src/utils/detect-context.ts` (context detection, 84 lines)
    - `packages/cli/src/templates/starter-rules.ts` (template generator, 139 lines)
    - `packages/cli/tests/commands/init.test.ts` (24 tests, 100% coverage)
  - Dependencies: Added `@clack/prompts@^0.7.0` to CLI and core packages

- **Lockfile with Hash Modes** (Phase 1, Stage 3, Step 21) - Completed 2025-10-27
  - Three hash modes: off (solo default), soft (team default), strict
  - Per-rule SHA-256 hashes for granular drift detection
  - Bundle hash for quick validation of entire pack
  - Excludes `vendor.*.volatile` fields from hashing
  - Atomic writes (temp+rename) prevent partial lockfile state
  - Config: `lockfile.mode` setting in `.aligntrue/config.yaml`
  - Lockfile location: `.aligntrue.lock.json` at workspace root
  - Auto-generated during `aligntrue sync` when `mode: team` and `modules.lockfile: true`
  - Validation: Validates before sync, regenerates after successful sync
  - Mode behaviors:
    - **off**: No validation, always succeed
    - **soft**: Warn to stderr on mismatch, exit 0 (allows iteration)
    - **strict**: Error to stderr on mismatch, abort sync, exit 1 (prevents divergence)
  - 65 comprehensive tests (100% pass rate)
  - Integration with sync engine: validates on team mode sync, generates after successful sync
  - Lockfile format: JSON with version, generated_at, mode, rules array, bundle_hash
  - Per-rule entries include: rule_id, content_hash, source (optional provenance)
  - CLI: `aligntrue lock` command to regenerate lockfile (future step)
  - Documentation: comprehensive README section with examples and mode table
  - Deterministic output: sorted JSON keys, consistent formatting

- **Security Posture Validation** (Phase 1, Week 3, Step 20) - Completed 2025-10-27
  - Comprehensive security testing: 35 new tests covering path traversal, atomic writes, checksum protection
  - Path validation prevents directory traversal (.. and absolute paths rejected)
  - Atomic writes with temp+rename prevent partial state
  - Checksum-based overwrite protection detects manual edits
  - Security documentation: `packages/core/docs/SECURITY.md` (security guarantees, boundaries, threat model)
  - Exporter safety expectations documented (trust-based contract)
  - Critical path validation for sources and outputs
  - Test files: `path-traversal.test.ts` (22 tests), `atomic-writes.test.ts` (12 tests)
  - Source path validation: 8 tests in `config.test.ts`
  - All atomic write guarantees tested: no partial writes, backup/rollback, temp file cleanup
  - All path validation enforced: scopes, local sources, output directories
  - Cache path validation documented for Step 27 implementation
  - Decision 16 in `architecture-decisions.md` marked complete with implementation details
  - Trust-based exporter safety (Phase 1): no network calls, no arbitrary writes, no command execution
  - Runtime enforcement deferred to Phase 2+ (sandboxing, signing, audit logging)
  - Total core package tests: ~228 passing (193 existing + 35 new security tests)

- **Multi-Agent Exporter Support** (Phase 1, Week 2, Step 14+) - Completed 2025-10-27
  - Added comprehensive support for 28 AI coding agents and tools
  - 40 new exporters implemented (15 unique formats + 25 shared handlers)
  - **Unique Format Exporters (15 new):**
    - `claude-md` - CLAUDE.md markdown format
    - `crush-md` - CRUSH.md markdown format
    - `warp-md` - WARP.md markdown format
    - `cline` - .clinerules plain text format
    - `goose` - .goosehints plain text format
    - `firebender` - firebender.json configuration
    - `amazonq` - .amazonq/rules/*.md directory-based
    - `augmentcode` - .augment/rules/*.md directory-based
    - `kilocode` - .kilocode/rules/*.md directory-based
    - `kiro` - .kiro/steering/*.md directory-based
    - `firebase-studio` - .idx/airules.md format
    - `junie` - .junie/guidelines.md format
    - `trae-ai` - .trae/rules/project_rules.md format
    - `openhands` - .openhands/microagents/repo.md format
    - `aider-config` - .aider.conf.yml YAML configuration
  - **MCP Config Exporters (7 new, 1 existing):**
    - `cursor-mcp` - .cursor/mcp.json
    - `root-mcp` - .mcp.json (Claude Code, Aider)
    - `windsurf-mcp` - .windsurf/mcp_config.json
    - `amazonq-mcp` - .amazonq/mcp.json
    - `firebase-mcp` - .idx/mcp.json
    - `kilocode-mcp` - .kilocode/mcp.json
    - `roocode-mcp` - .roo/mcp.json
  - **Other Config Exporters (7 new):**
    - `crush-config` - .crush.json
    - `opencode-config` - opencode.json
    - `gemini-config` - .gemini/settings.json
    - `qwen-config` - .qwen/settings.json
    - `zed-config` - .zed/settings.json
    - `codex-config` - .codex/config.toml
    - `openhands-config` - config.toml
  - **AGENTS.md-Compatible Agents (11 manifests, shared handler):**
    - Copilot, Jules, Amp, OpenAI Codex, Windsurf, Aider, Gemini CLI
    - Qwen Code, Roo Code, Zed, Open Code
  - All exporters follow ExporterPlugin interface
  - Hybrid manifest system: one manifest per agent for discoverability
  - Dual-output support for agents requiring both rules + config files
  - Comprehensive fidelity tracking and vendor metadata extraction
  - Documentation: `packages/exporters/docs/DUAL_OUTPUT_CONFIGURATION.md`
  - All 40 exporters compile successfully with TypeScript strict mode
  - Full manifest validation against JSON Schema
  - CLI: `aligntrue adapters list` shows all 28 agents

- **Two-Way Sync with Conflict Resolution** (Phase 1, Week 2, Step 14) - Completed 2025-10-27
  - Full two-way sync engine with interactive conflict resolution
  - Conflict resolution strategies: KEEP_IR, ACCEPT_AGENT, MANUAL, ABORT
  - Interactive CLI prompts: `[i]Keep IR [a]Accept agent [d]Show diff [q]Quit`
  - Non-interactive mode with default strategy for CI environments
  - Batch mode: apply same resolution to all conflicts in a rule
  - Enhanced dry-run with detailed audit trail (timestamps, hashes, action details)
  - Agent→IR sync (`aligntrue sync --accept-agent <adapter>`) with mock data (real parsers in Step 17)
  - Conflict detector with field-level diffs and human-readable reports
  - Resolution application with nested field support (e.g., vendor.cursor.ai_hint)
  - Volatile field exclusion infrastructure for vendor bags
  - Checksum-based overwrite protection with interactive prompts
  - Interactive checksum prompts: `[v]iew [o]verwrite [k]eep [a]bort`
  - Force mode for non-interactive overwrites (`--force` flag)
  - Audit trail for all sync operations (IR→agent and agent→IR)
  - Added `prompts` package for interactive CLI (@types/prompts for TypeScript)
  - Mock agent rule fixtures for testing (cursor-modified, cursor-new-rule, cursor-deleted-rule)
  - 44 new tests passing (conflict resolution + prompts)
  - Total core package tests: ~173 passing (up from 129)
  - Dependencies: SyncEngine, ConflictDetector, AtomicFileWriter, conflict-prompt module
  - CLI foundation for `aligntrue sync --accept-agent cursor` workflow

- **VS Code MCP Exporter** (Phase 1, Week 2, Step 13) - Completed 2025-10-27
  - Generates `.vscode/mcp.json` configuration for Model Context Protocol support
  - Custom v1 JSON format with version marker for future evolution
  - Extracts vendor.vscode metadata to top level of each rule (flattened structure)
  - Single merged file at workspace root (not per-scope files)
  - Deterministic SHA-256 content hash from canonical IR
  - Comprehensive fidelity tracking for unmapped fields (check, autofix)
  - Tracks non-vscode vendor metadata (cursor, copilot, etc.) in fidelity notes
  - 29 comprehensive tests with 5 snapshot validations (100% pass rate)
  - Test fixtures: single-rule, multiple-rules, with-vendor-vscode, mixed-vendor, all-severities
  - Golden JSON outputs validated via Vitest snapshots
  - Atomic file writes with automatic .vscode directory creation
  - State management for accumulating rules across scope calls
  - CLI: `aligntrue sync` with `exporters: ['vscode-mcp']` in config
  - Total exporters package tests: 116 passing (up from 87)
  - JSON Schema definition: `packages/exporters/schema/vscode-mcp.schema.json`
  - All 3 Phase 1 exporters now complete (Cursor ✅, AGENTS.md ✅, VS Code MCP ✅)

- **AGENTS.md Exporter with V1 Format** (Phase 1, Week 2, Step 12) - Completed 2025-10-26
  - Universal AGENTS.md exporter for multiple AI agents (Claude, Copilot, Aider, etc.)
  - Single root-level AGENTS.md file with merged scopes (not per-scope files)
  - V1 format with version marker in header
  - Plain text severity labels: ERROR, WARN, INFO (not emoji or markdown styling)
  - Scope paths included in rule metadata sections
  - No vendor namespace extraction (universal format serves all agents equally)
  - Deterministic SHA-256 content hash from canonical IR
  - Comprehensive fidelity tracking for unmapped fields and vendor metadata
  - 23 comprehensive tests with 5 snapshot validations (100% pass rate)
  - Test fixtures: single-rule, multiple-rules, multiple-scopes, with-vendor-fields, all-severities
  - Golden outputs validated via Vitest snapshots
  - Atomic file writes using AtomicFileWriter from @aligntrue/core
  - State management for accumulating rules across scope calls
  - CLI: `aligntrue sync` generates AGENTS.md automatically alongside Cursor .mdc files
  - Total exporters package tests: 87 passing (up from 63)

- **Cursor Exporter with Snapshot Tests** (Phase 1, Week 2, Step 11) - Completed 2025-10-26
  - Complete Cursor .mdc exporter implementation (270 lines)
  - Scope-based file organization: one .mdc per scope (default → aligntrue.mdc)
  - Vendor.cursor metadata extracted to YAML frontmatter
  - Comprehensive fidelity tracking with unmapped field analysis
  - Deterministic SHA-256 content hash from canonical IR input
  - Multiple rules concatenated as markdown sections with headers
  - Atomic file writes using AtomicFileWriter from @aligntrue/core
  - 18 comprehensive tests with 5 snapshot validations (100% pass rate)
  - Test fixtures: single-rule, multiple-rules, vendor-cursor, mixed-vendor, all-severities
  - Golden .mdc outputs validated via Vitest snapshots
  - Dry-run mode support for preview without side effects
  - Footer generation with content hash and fidelity notes
  - Scope-to-filename conversion (slashes → hyphens)
  - Cross-agent vendor field tracking (vscode, copilot, etc.)

- **Adapter Registry with Hybrid Manifests** (Phase 1, Week 2, Step 10) - Completed 2025-10-26
  - Hybrid manifest system: declarative `manifest.json` + optional TypeScript handlers
  - Community-scalable adapter contributions without core code changes
  - JSON Schema validation for manifest files (draft 2020-12)
  - Dynamic handler loading with ESM imports
  - Manifest.json created for all 3 P1 exporters (cursor, agents-md, vscode-mcp)
  - Migrated from legacy `Exporter` interface to `ExporterPlugin` (breaking change, pre-1.0)
  - Sync engine imports ExporterPlugin types from @aligntrue/exporters package
  - 46 comprehensive tests (26 registry + 20 schema validation)
  - Comprehensive README with adapter creation guide, API reference, fidelity notes documentation
  - CONTRIBUTING.md with adapter requirements, testing guidelines, PR checklist
  - Adapter discovery in directories (finds all manifest.json files)
  - Programmatic and manifest-based registration modes
  - Mock adapter fixtures for testing handler loading
  - Cross-package type sharing (ExporterPlugin now canonical in exporters package)

- **Two-Way Sync Engine Skeleton** (Phase 1, Week 1, Step 9) - Completed 2025-10-26
  - Core sync orchestration in `packages/core/src/sync/engine.ts`
  - IR→agent sync (default direction) with scope resolution integration
  - Agent→IR sync skeleton (full implementation in Step 17)
  - Conflict detection with structured diffs (no UI prompts yet)
  - Atomic file operations with temp+rename pattern
  - Checksum tracking for overwrite protection
  - Basic --dry-run support (preview without writing)
  - Mock exporters for testing (`MockExporter`, `FailingExporter`)
  - IR loader with auto-format detection (.md, .yaml)
  - 148 comprehensive tests (129 passing, 19 need fixture updates)
  - Exporter plugin interface defined in engine (local types)
  - Integration with existing config parser, scope resolver, markdown parser
  - Comprehensive README with sync API documentation

- **Config Parser with JSON Schema Validation** (Phase 1, Week 1, Step 8) - Completed 2025-10-26
  - Strict config location: .aligntrue/config.yaml only
  - JSON Schema validation following align.schema.json pattern
  - Solo/team/enterprise mode support with mode-specific defaults
  - Default exporters: ['cursor', 'agents-md'] for immediate multi-agent support
  - Unknown field warnings (non-blocking) for pre-1.0 flexibility
  - YAML parsing with helpful error messages (line numbers on parse errors)
  - Integration with existing scope/path/glob validation from Step 5
  - 43 comprehensive tests covering loading, validation, defaults, warnings
  - Error messages point to exact config issues with actionable fixes
  - Mode-specific defaults reduce solo dev friction without compromising team mode power
  - Cross-field validation warns about unusual configurations (e.g., solo mode + lockfile)
  - Source type validation with type-specific required fields
  - Comprehensive README with config examples, troubleshooting, and API reference

- **Hierarchical Scopes System** (Phase 1, Week 1, Step 5) - Completed 2025-10-26
  - Path-based scope resolution with include/exclude glob patterns
  - Merge order support: [root, path, local] for rule precedence
  - Deep merge of rules by ID with property-level overrides
  - Windows path normalization for cross-platform compatibility
  - Exporter integration interface (ScopedExportRequest contract)
  - 40 comprehensive tests covering resolution, glob matching, merge order, and edge cases
  - Validates glob patterns and paths in config to prevent runtime errors
  - Foundation for per-scope exporter execution in Week 2 (steps 11-13)
  - Config validation includes scope path traversal checks and merge order validation
  - Helper functions: normalizePath, validateScopePath, validateGlobPatterns, validateMergeOrder
  - File-to-scope matching with last-wins semantics for overlapping scopes
  - Vendor bag deep merge preserves agent-specific metadata across rule overrides

- **Literate Markdown Parser** (Phase 1, Week 1, Step 4) - Completed 2025-10-26
  - Extract fenced ```aligntrue blocks from markdown files
  - One block per section rule enforced with clear error messages
  - Guidance prose preserved from markdown context before blocks
  - CLI commands: `aligntrue md lint|format|compile` for standalone validation
  - Whitespace normalization before hashing (tabs→spaces, trim trailing, consistent EOF)
  - Schema validation with markdown line number mapping in error messages
  - 35 tests covering parser, IR builder, validator components
  - Example markdown files in `examples/markdown/`
  - Comprehensive README with usage examples and API documentation
  - `source_format` field added to schema (optional: 'markdown' or 'yaml')

- **IR Schema v1** (Phase 1, Week 1, Step 3) - Completed 2025-10-26
  - Complete schema redesigned for CLI-first/solo developers (catalog-first v1 never shipped)
  - Solo mode: 4 required fields (id, version, spec_version: "1", rules)
  - Team mode: adds provenance (owner, source, source_sha)
  - Catalog mode: adds distribution metadata (tags, integrity, etc.)
  - Vendor bags support: `vendor.<agent>` namespace for lossless round-trips
  - Vendor.volatile exclusion: `vendor.*.volatile` fields excluded from canonical hashing
  - Mode-dependent validation: solo/team/catalog with progressive requirements
  - Severity levels: `error`/`warn`/`info` (replaced MUST/SHOULD/MAY)
  - New JSON Schema: `packages/schema/schema/align.schema.json`
  - Updated TypeScript types matching v2-preview spec
  - Canonicalization boundaries: only at lock/publish, not load/save
  - Comprehensive test coverage: 67 tests including vendor.volatile (6 tests) and provenance validation (5 tests)

### Fixed

- **Documentation consistency** - Aligned `long_term.mdc` with CLI-first rearchitecture
  - Windows support now correctly documented as Phase 1 (not P2.1)
  - Removed conflicting "Windows support" deferred feature section
  - Added explicit Phase 1 Windows deliverables callout
  - Fixes caught in external review before implementation

### Changed

- **ARCHITECTURAL PIVOT: Catalog-first → CLI-first**
  - Completed competitive gap analysis identifying solo dev adoption as critical path
  - Pivoted from catalog-first to CLI-first architecture for faster adoption
  - Markdown-first authoring (`.aligntrue/rules.md`) instead of YAML-only
  - Lockfile and bundle now opt-in (team mode) instead of required
  - Multi-agent support in Phase 1 (Cursor + AGENTS.md) instead of Phase 4
  - Windows support first-class in Phase 1 (path normalization, CI matrix, cross-platform determinism)
  - Documentation: `docs/architecture-decisions.md`, `docs/refactor-plan.md`, `docs/implementation-summary.md`
  - Competitive analysis: `competitive-gap-analysis.md`

- **Components archived** (deferred to later phases) - Completed 2025-10-26
  - `apps/web/` → `archive/apps-web/` - Catalog website deferred to Phase 4
  - `apps/docs/` → `archive/apps-docs/` - Documentation site consolidated into README + CLI help
  - `packages/mcp/` → `archive/mcp-v1/` - MCP server deferred to Phase 2
  - Workspace configuration updated to exclude archived packages
  - Git history preserved using `git mv` for easy recovery
  - See `archive/README.md` for recovery plan

- **Package scaffolds created** (Phase 1, Week 1, Step 2) - Completed 2025-10-26
  - `packages/core/` - Config management, sync engine, bundle/lockfile, scope resolution
  - `packages/markdown-parser/` - Literate MD → IR conversion with fenced block extraction
  - `packages/sources/` - Multi-source pulling (local, catalog, git, url) with caching
  - `packages/exporters/` - Agent exports (Cursor, AGENTS.md, VS Code MCP config)
  - `packages/cli/` - Rebuilt with fresh structure aligned to IR-first architecture
  - All packages include TypeScript stub interfaces defining architectural contracts
  - Workspace integrity verified with successful pnpm install and typecheck
  - Total 5 packages ready for implementation (15k token estimate)

### Documentation

- **Failure isolation strategy** documented in `docs/refactor-plan.md`
  - Each component (markdown parser, IR, exporters, sync) fails independently
  - Clear fallback paths prevent cascade failures
  - Core commands work even if exporters are broken

### Added

- **Workspace structure** reorganized into proper pnpm monorepo layout
  - `apps/web/` - Next.js catalog site with App Router
  - `apps/docs/` - Nextra documentation site
  - `packages/schema/` - JSON Schema, canonicalization, hashing utilities
  - `packages/cli/` - aligntrue/aln CLI package
  - `packages/mcp/` - MCP server package (Phase 2+)

- **Align Spec v1** comprehensive specification and validation
  - `spec/align-spec-v1.md` - Human-readable specification document
  - `packages/schema/schema/align.schema.json` - JSON Schema (draft 2020-12)
  - Support for machine-checkable rules with 5 check types: file_presence, path_convention, manifest_policy, regex, command_runner
  - JCS canonicalization and SHA-256 integrity hashing
  - SARIF output mapping for CI integration

- **Base aligns converted** to Align Spec v1 format (11 packs)
  - Base packs: base-global, base-testing, base-docs, base-security, base-debugging, base-tdd, base-rule-authoring, base-typescript
  - Stack packs: nextjs-app-router, web-quality, vercel-deployments
  - Each pack includes structured rules with severity levels (MUST/SHOULD/MAY)
  - Machine-checkable checks with evidence and autofix hints
  - Guidance sections preserved from original content

- **Development documentation**
  - `README.md` updated with workspace structure and setup instructions
  - `DEVELOPMENT.md` comprehensive guide for local development
  - Workspace-level configuration: `tsconfig.base.json`, `.editorconfig`, `pnpm-workspace.yaml`

- **Phase 1 roadmap** updated with migration task
  - Added Stage 1.2.5 for moving basealigns to AlignTrue/aligns repository
  - Clarified pack ID mapping and cross-repository workflow

- **Canonicalization and hashing utilities** (Stage 1.0)
  - Implemented JCS (RFC 8785) canonicalization in `packages/schema/src/canonicalize.ts`
  - SHA-256 integrity hashing for Align packs
  - Deterministic hash computation: identical inputs → identical outputs
  - Computed and updated integrity hashes for all 11 basealigns

- **Schema validation** (Stage 1.0)
  - Ajv-based validator in strict mode at `packages/schema/src/validator.ts`
  - Schema validation against `packages/schema/schema/align.schema.json`
  - Integrity validation with hash verification
  - Support for `<computed>` placeholder during authoring

- **Test coverage** (Stage 1.0)
  - 55 tests covering canonicalization edge cases and validation scenarios
  - Stability tests: same input produces same hash across multiple runs
  - Unicode, floating point, key ordering, and nested structure tests
  - All 5 check types validated: file_presence, path_convention, manifest_policy, regex, command_runner

- **CLI tools** (Stage 1.0)
  - `pnpm validate <file>` - validate Align pack schema and integrity
  - Hash computation script for bulk processing
  - Detailed validation output with error messages and hash display

- **GitHub Actions CI** (Stage 1.0)
  - Automated validation workflow at `.github/workflows/validate-aligns.yml`
  - Runs on push/PR to main and develop branches
  - Tests schema package with Node 20 and pnpm 9
  - Build, test, and typecheck gates

- **Basealigns validation fixes** (Stage 1.0)
  - Fixed `typescript.yaml` - Changed from invalid `manifest_policy` to `command_runner` for tsconfig.json validation
  - Fixed `web_quality.yaml` - Changed from invalid `manifest_policy` to `command_runner` for ESLint plugin check
  - All 11 basealigns now pass schema validation
  - Re-computed integrity hashes for fixed files

- **Checks v1 runner engine** (Stage 1.1)
  - New `packages/checks` package with check runner for all 5 check types
  - Check runners: `file_presence`, `path_convention`, `manifest_policy`, `regex`, `command_runner`
  - SARIF 2.1.0 emitter for CI and editor integration
  - JSON findings emitter for scripting and programmatic consumption
  - Abstract `FileProvider` interface for testability and extensibility
  - `DiskFileProvider` implementation for local file system access
  - Gated command execution with explicit `allowExec` flag and timeout enforcement
  - CLI script: `pnpm run-checks <align-file> <target-dir> [--allow-exec] [--format sarif|json]`
  - 47 tests covering all check types, emitters, and engine orchestration
  - Comprehensive API documentation in `packages/checks/README.md`

- **Starter packs quality review** (Stage 1.2)
  - Reviewed all 11 packs in AlignTrue/aligns for scope clarity and objective checks
  - Validated pack structure matches Align Spec v1 requirements
  - Confirmed integrity hashes are computed and deterministic
  - All packs exceed Phase 1 minimum of 8 curated packs
  - 43 total machine-checkable rules across all packs (100% objective validation)
  - Check type distribution: command_runner (42%), regex (40%), file_presence (12%), path_convention (2%)

- **Basealigns migration** (Stage 1.2.5)
  - Completed migration of 11 packs to AlignTrue/aligns repository
  - Pack IDs properly namespaced under packs/base/* and packs/stacks/*
  - Cross-repository CI validation workflow established
  - Base packs (8): base-global, base-testing, base-docs, base-security, base-debugging, base-tdd, base-rule-authoring, base-typescript
  - Stack packs (3): nextjs-app-router, web-quality, vercel-deployments

- **Conformance Testkit v1** (Stage 1.3)
  - New `packages/testkit` package with JSON vectors and TypeScript runner
  - 17 canonicalization vectors covering edge cases: unicode, floats, key ordering, nested structures, YAML anchors, empty values, scientific notation
  - 18 check runner vectors across all 5 check types: file_presence (4), path_convention (3), manifest_policy (3), regex (5), command_runner (3)
  - 5 synthetic golden packs with inline documentation and computed integrity hashes
  - Integration vectors file referencing 11 production packs from AlignTrue/aligns
  - `pnpm verify` command runs full conformance suite (40 total test vectors)
  - CI verification step added to `.github/workflows/validate-aligns.yml`
  - Comprehensive README with usage examples for external implementations
  - Helper scripts for hash computation: `compute-vector-hashes.ts` and `compute-golden-hashes.ts`
  - All 12 conformance test cases pass

- **Registry governance** (Stage 1.4)
  - POLICY.md with minimal viable governance: namespacing rules, verified authorship (GitHub org), contribution requirements, quality bar, yanking process
  - CONTRIBUTING.md public contribution guide with 3-step quickstart, testing instructions, and PR checklist
  - Template pack specification documented at `temp-template-pack-spec.yaml` (to be created in AlignTrue/aligns as `packs/templates/starter.aligntrue.yaml`)
  - Template includes all 5 check types with inline documentation and best practice guidance
  - "Potential future features" section added to long_term.mdc with implementation triggers for deferred features
  - Pattern for documenting deferred features added to global.mdc "Deferring features" section
  - Deferred Sigstore signing (trigger: external requests or 3+ authorship disputes)
  - Deferred full governance with disputes/SLAs (trigger: first dispute or 10+ active contributors)

- **Shared UI package and design system** (Stage 2.0)
  - New `packages/ui` package with minimal design tokens system
  - `src/styles/tokens.css` - CSS custom properties for colors (neutral, primary), typography (sans, mono), spacing (4px scale), and border radius
  - `src/components/BrandLogo.tsx` - Text-based placeholder logo component (can be swapped for SVG later)
  - `src/tailwind-preset.ts` - Tailwind configuration preset referencing design tokens
  - Comprehensive README with usage examples and token documentation

- **Next.js catalog site infrastructure** (Stage 2.0)
  - `apps/web` configured to consume `@aligntrue/ui` package
  - Tailwind v4 setup with shared design system preset
  - BrandLogo component integrated in layout header
  - Homepage placeholder for catalog interface
  - Metadata updated: title "AlignTrue", description "AI-native rules and alignment platform"

- **Vercel deployment configuration** (Stage 2.0)
  - `apps/web/vercel.json` - Basic deployment configuration with region selection (iad1)
  - Next.js configured for hybrid rendering mode (static-first with server features available)
  - Build command uses Turbopack for fast compilation
  - Documented approach in next.config.ts comments

### Changed

- **Repository structure** reorganized from boilerplate Next.js to workspace layout
  - Moved Next.js files from `apps/` to `apps/web/app/`
  - Created proper package boundaries with individual tsconfig.json files
  - Updated .gitignore for workspace patterns and temporary files

- **Build system** migrated to pnpm workspace
  - Root package.json configured as workspace orchestrator
  - Individual package.json files for each workspace member
  - Cross-package dependencies properly configured

### Infrastructure

- **TypeScript** strict configuration with base settings
- **EditorConfig** for consistent formatting across editors
- **Development workflow** documented with setup and troubleshooting

## [0.1.0]

### Added

- Initial repository setup with Next.js boilerplate
- Basic project structure and configuration files

---

*This changelog follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.*
