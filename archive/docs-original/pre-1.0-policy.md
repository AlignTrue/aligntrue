# Pre-1.0 Schema Evolution Policy

**Status:** Pre-1.0 Alpha (Private Development)  
**Current Version:** 0.1.x  
**Users:** Private development - no public users yet  
**Last Updated:** 2025-10-28

## Core principle

**Before 1.0, we can iterate the schema freely.**

Why? Because we're in private development through Phase 4, and the cost of NOT optimizing the schema is higher than the cost of breaking changes.

## Migration framework trigger

**DO NOT implement migration tooling until:**

- You reach 1.0 stable release, AND
- You need to ship a breaking schema change, AND
- The breaking change would impact existing users

**Current Status:** Migration framework deferred to conditional "When Breaking Changes" section in `long_term.mdc`

## Pre-1.0 breaking change process

During private development (Phases 1-4):

1. Update schema in `packages/schema/src/ir.ts`
2. Update validators and tests
3. Add CHANGELOG entry under "Changed" with "BREAKING" label
4. Bump minor version (0.x.y → 0.x+1.0)
5. No migration required - project remains private

## When we hit 1.0

**Requirements for 1.0 stable:**

- Phases 1-4 complete (CLI, import, team mode, catalog website)
- Schema design validated through internal usage
- Initial public users onboarded successfully
- Semver commitment in place

**At 1.0 launch:**

- Schema becomes stable
- Breaking changes require MAJOR version bump
- Deprecation warnings before removal (one MINOR release notice)
- Migration framework implemented only when FIRST breaking change needed

## Migration framework (post-1.0, conditional)

**Implement ONLY when:**

- Post-1.0 release
- Breaking schema change required
- User impact justifies tooling investment (~60k tokens)

**Before implementing, ask:**

- What breaking change is needed and why?
- How many user repos would be affected?
- What alternatives exist (deprecation, aliases, additive changes)?
- Does user impact justify migration tooling investment?

**Implementation scope:** See `long_term.mdc` "When Breaking Changes" section for details.

## Examples

### Pre-1.0 Breaking Change (OK)

```yaml
# Before (v0.1.x)
rules:
  - id: my-rule
    severity: error

# After (v0.2.0) - field renamed
rules:
  - id: my-rule
    level: error  # renamed from severity
```

**Process:**

- Update schema
- Update tests
- CHANGELOG: "BREAKING: Renamed `severity` to `level` in rule schema"
- Bump to 0.2.0
- No migration needed (private development)

### Post-1.0 Breaking Change (Requires Review)

```yaml
# If this happens after 1.0 release with public users:
# 1. Confirm user impact
# 2. Evaluate alternatives (aliases, deprecation)
# 3. If unavoidable, implement migration framework
# 4. Provide migration tooling and clear upgrade path
```

## Versioning strategy

**Pre-1.0 (Current):**

- 0.x.y format
- Breaking changes bump minor (0.1.0 → 0.2.0)
- Features/fixes bump patch (0.1.0 → 0.1.1)

**Post-1.0:**

- Semver strictly enforced
- Breaking changes bump major (1.0.0 → 2.0.0)
- New features bump minor (1.0.0 → 1.1.0)
- Fixes bump patch (1.0.0 → 1.0.1)

## References

- Zero-users principle: `.cursor/rules/no_premature_backwards_compatibility.mdc`
- Phase 2 roadmap: `.cursor/rules/phase2_implementation.mdc` (migrations removed)
- Migration framework: `.cursor/rules/long_term.mdc` "When Breaking Changes" section
- Schema source: `packages/schema/src/ir.ts`

---

**Remember:** Pre-1.0 means freedom to optimize. Don't build migration tooling speculatively.
