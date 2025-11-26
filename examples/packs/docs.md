---
id: "aligns/base/base-docs"
version: "1.0.0"
summary: "Docs-as-code baseline: readme-first, CI-enforced, minimal and testable"
tags: ["documentation", "readme", "changelog", "paved-road"]
---

# Docs-as-Code Baseline

This align establishes documentation standards: readme-first approach, CI-enforced checks, copy-pasteable snippets, and minimal DRY-based references.

## Core principles

- **Readme-first**: Single authoritative README at repo root
- **Change behavior? Change docs**: Update documentation in the same PR
- **Copy-pasteable snippets**: Verified, minimal, runnable examples
- **DRY and reference-first**: Link to docs, don't duplicate
- **CI-enforced**: Lint, link-check, spell-check in CI

## Repository structure

Short-form at top level:

- `README.md` - Main entry point
- `CONTRIBUTING.md` - How to contribute
- `CHANGELOG.md` - Changes by version
- `LICENSE` - Licensing info

Longer docs under `docs/`:

- One topic per page
- Keep pages concise and focused
- Cross-reference with relative links

## README Requirements

Every repository must have a README with:

**Required:** Quickstart section with runnable commands

- Clear, copy-pasteable commands
- Minimal dependencies
- Shows immediate value

**Example sections:**

- What it is
- How to try it
- How to run tests
- How to build
- How to contribute

## Behavioral changes

**Requirement:** Behavior changes must include documentation updates.

If you modify functionality:

- Update README or relevant docs in same PR
- Keep examples current
- Remove obsolete guidance
- Verify links still work

## CI Enforcement

Automated checks in every PR:

- **Lint markdown** - Consistent formatting
- **Check links** - No broken references
- **Spell-check** - Where configured
- **Generated sites** - Built but not committed to repo

## Release notes

Maintain changelog with:

- **CHANGELOG.md** or generate from Conventional Commits
- Link releases to relevant docs
- Group changes by type: Added, Changed, Fixed, Removed
- Clear, user-facing descriptions

## Documentation anti-patterns

- Outdated examples
- Broken links
- Duplicated content
- Over-technical README
- Docs that need a tutorial to understand
