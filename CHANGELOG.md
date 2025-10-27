# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

### Documentation
- Added `docs/mcp-scope.md` - Clarifies AlignTrue's MCP scope (generates config files, not server declarations)
- Updated `long_term.mdc` - Removed "Full MCP server" from Phase 2, added to deferred features with clear triggers
- Positioned AlignTrue as complementary to Ruler (AlignTrue for rules, Ruler for MCP servers)

### Added

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
