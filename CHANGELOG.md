# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Phase 8: Team Mode Updates for Sections**
  - Lockfile generator now supports section-based packs with fingerprint-based tracking
  - Lockfile validator detects modified, new, and deleted sections
  - Bundle merger handles section-based pack merging and conflict resolution
  - Drift detection works seamlessly with fingerprints and sections
  - Full test coverage for section-based lockfile operations (21 new tests)

- **Phase 9: Example Packs Migration**
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
