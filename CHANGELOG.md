# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

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

## [0.1.0] - 2025-01-01

### Added

- Initial repository setup with Next.js boilerplate
- Basic project structure and configuration files

---

*This changelog follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.*
