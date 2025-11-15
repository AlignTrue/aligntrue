# @aligntrue/file-utils

## 1.0.0-alpha.5

### Major Changes

- c0d9a0f: ### Features
  - feat(release): Add smart changeset creator with auto-detection and recommendations
  - feat(validation): Add deprecation enforcement and cross-package import validation
  - feat: Enable upstream drift detection and team approval workflow
  - feat: Auto-merge security patches from Dependabot
  - feat: Multi-file source support
  - feat: Implement Ruler Feature Parity - backup, gitignore, ruler migration, scope discovery, agent detection
  - feat: Better dev UX
  - feat: Add strict IR validation, config commands, and test infrastructure
  - feat: Implement ref resolution

  ### Fixes
  - fix(changesets): Add targeted js-yaml override for Changesets compatibility
  - fix(release): Fix YAML frontmatter quoting in generated changesets
  - fix(changesets): Restore compatible get-packages version
  - fix(cli): Extend help performance test timeout for Windows CI
  - fix(changesets): Add debug script and complete automation fixes
  - fix(changeset): Simplify config to avoid dependency graph issues
  - fix: Repair release process and sync with NPM
  - fix: Fix Invalid Flag Handling
  - fix: Fixed duplicate warning messages
  - fix(cli): Increase Windows help performance threshold to 2800ms
  - ...and 69 more fixes

  ### Other Changes
  - chore: Add changeset
  - chore: Remove malformed changeset file
  - chore: Add changeset
  - chore: Add changeset
  - docs: Update docs
  - ...and 32 more changes

## 0.1.1-alpha.4

### Patch Changes

- 97e54ee: Post-alpha.3 improvements: License fields added to all packages, test fixes, Windows compatibility improvements, and continued sections format refinements.

## 0.1.1-alpha.3

### Patch Changes

- 247c721: Major breaking changes to IR format and multi-agent support. Includes new Gemini MD exporter, hybrid agent detection, auto-backup by default, and automatic rule ID fixing on import.
