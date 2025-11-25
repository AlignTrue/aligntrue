---
id: "packs/base/base-global"
version: "1.0.0"
summary: "Global baseline for AI-assisted repos: CI gates, contribution workflow, deterministic behavior"
tags: ["global", "baseline", "ci", "paved-road"]
---

# Global baseline for AI-assisted repos

This pack establishes paved-road commands and consistent workflow patterns for AI-assisted repositories. It complements docs, testing, and TDD packs while deferring to security requirements.

## Core principles

- Establish paved-road commands and use them consistently
- Keep PRs focused and small
- Require CI gates on every PR (tests + lint)
- Enforce deterministic behavior
- Update docs when behavior changes
- Keep generated artifacts out of VCS

## PR and Commit Discipline

Use Conventional Commits format for all commit messages:

```
type(scope): description

Examples:
- feat: add server pagination
- fix(auth): resolve token expiry issue
- docs: update API reference
```

Keep one cohesive change per PR. CI must pass before merge.

## CI Gates Required

Every repository must have CI workflow configuration:

- Tests must run on every PR
- Linting must pass before merge
- Missing CI workflow configuration is an error

Add CI workflow in `.github/workflows/` that runs tests and lints on every PR.

## Version control hygiene

Keep generated artifacts out of version control:

- Add `dist/`, `build/`, `out/`, `.tsbuildinfo` to `.gitignore`
- Remove any accidentally committed build artifacts
- Verify with: `git ls-files | grep -E '(dist/|build/|out/|\\.tsbuildinfo)'` (should return nothing)

## Deterministic behavior

Ensure reproducible builds and behavior:

- Pin tool versions in package managers
- Seed randomness in tests
- Use stable ordering for collections
- Delegate supply-chain specifics to security pack

## Documentation updates

- Update docs and examples when interfaces change
- Reference other packs using @ notation
- Keep README and guides in sync with code

## Output contract

For significant changes:

1. Summary of change
2. Rationale
3. Updated rule text only
4. Impacted areas/precedence
5. Tests/examples
6. Conflict check

## Examples

**Good:** Run tests and lint in CI; block merge on failure

**Bad:** Merge first and fix tests later
