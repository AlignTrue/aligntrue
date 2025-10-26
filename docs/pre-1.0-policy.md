# Pre-1.0 Migration Policy

**Status:** Active (as of 2025-10-26)  
**Applies to:** AlignTrue v0.x (pre-1.0 releases)  
**Schema Version:** `spec_version: "2-preview"`

---

## Current Status

AlignTrue is in **preview** status. The project is pre-1.0 and under active development.

**What this means:**
- Schema may change between releases
- No migration tooling provided yet
- Breaking changes possible without extensive backwards compatibility
- Early adopter feedback shapes final 1.0 design

**What this does NOT mean:**
- Not production-ready (it is - determinism and tests are solid)
- Not safe to use (it is - just expect schema iterations)
- Not valuable (it is - provides immediate benefit for rule management)

---

## Schema Versioning

### Current: `spec_version: "2-preview"`

All AlignTrue IR files should use:

```yaml
spec_version: "2-preview"
```

**"preview" status indicates:**
- Schema is stable enough for daily use
- May evolve based on user feedback
- Migration tooling will be added before 1.0
- We'll announce breaking changes clearly

### Future: `spec_version: "2"` (1.0 stable)

When we reach 1.0 stable:
- Schema locked for breaking changes
- Migration tooling active
- Semver guarantees apply
- Backwards compatibility maintained

---

## Breaking Change Policy

### Pre-1.0 (Current)

**We reserve the right to make breaking changes** to:
- IR schema fields and structure
- Config file format
- Lockfile format
- Exporter output formats
- CLI commands and flags

**However:**
- Changes will be clearly announced in CHANGELOG
- Migration guides provided for each breaking change
- Minimizing churn is a priority (but not at expense of better design)
- User feedback welcome and encouraged

### Communication

**When we make breaking changes:**
1. Announce in CHANGELOG with `BREAKING:` prefix
2. Provide migration steps (what to change, how to change it)
3. Include examples of before/after
4. Update docs to reflect new format

**Users can:**
- Pin to specific version: `pnpm add @aligntrue/cli@0.1.5`
- Wait for stable releases: `pnpm add @aligntrue/cli@stable`
- Follow changelog closely
- Provide feedback on breaking changes

---

## Migration Framework Triggers

**Migration tooling will be added when we reach:**

- **50+ active repositories** using AlignTrue in production, OR
- **10+ organizations** with multiple repos each, OR
- **Planned breaking change** that would significantly impact users

**Estimated timeline:** Phase 2 (after CLI-first Phase 1 complete)

### Why Wait?

**Benefits of waiting:**
- Iterate faster without migration machinery overhead
- Learn from real usage patterns before locking design
- Avoid premature abstraction in migration logic
- Focus implementation effort on user-facing features

**We're not being lazy:**
- Migration framework design is documented (see below)
- Implementation is straightforward when needed
- Triggers ensure we add it before pain point

---

## Future Migration Approach

**When we build migration tooling, it will be:**

### Pure JSON Transforms

```typescript
function migrateV2PreviewToV2(input: unknown): unknown {
  // Pure function: input JSON → output JSON
  // No I/O, no side effects, deterministic
  return transformed;
}
```

**Constraints:**
- No file I/O during transformation
- No network calls
- No hashing or canonicalization (just structure changes)
- Idempotent (running twice = same result)
- Validates input and output

### Validation Sandwich

```typescript
// Before
const validated = validateSchema(input, fromVersion);

// Transform
const migrated = migrate(validated);

// After
const revalidated = validateSchema(migrated, toVersion);
```

**Ensures:**
- Invalid input rejected (don't migrate garbage)
- Output is valid for target version
- Clear error messages if something breaks

### CLI Safety

```bash
# Default: dry-run shows diff, doesn't write
aligntrue migrate --from 2-preview --to 2

# Explicit write required
aligntrue migrate --from 2-preview --to 2 --write

# With backup
aligntrue migrate --from 2-preview --to 2 --write --backup
```

**Features:**
- Diff preview before applying
- Explicit `--write` required (no accidents)
- Optional `--backup` creates `.bak` file
- Exit codes: 0=success, 1=validation error, 2=conflict

### YAML CST Preservation (Maybe)

**Question:** Should migrations preserve comments and formatting?

**Phase 1:** No - Simple YAML round-trip loses comments  
**Future:** Consider YAML CST parser if users care

**Rationale:** Ship fast now, add if requested. Most users won't care about comment preservation.

### No Downgrades

**Phase 1:** Only forward migrations (`v2-preview → v2`)

**Why:**
- Downgrades rarely needed in practice
- Doubles implementation and test complexity
- Can add later if CI reproducibility demands it

**If needed:** Users can pin CLI version or maintain separate branches

---

## Early Adopter Expectations

### What You Get

✅ **Stable core functionality:**
- IR validation and canonicalization (when needed)
- Sync to multiple agents (Cursor, AGENTS.md, MCP)
- Machine-checkable rules with SARIF output
- Git-based collaboration (team mode)

✅ **Production-ready for:**
- Solo developers managing rules locally
- Small teams (< 10 people) collaborating via Git
- Projects willing to adapt to schema changes

✅ **Support and communication:**
- Active development and bug fixes
- Responsive to feedback and issues
- Clear changelog and migration guides
- Community discussions for design decisions

### What You Don't Get

❌ **Not yet available:**
- Guaranteed schema stability (coming in 1.0)
- Automated migration tooling (coming when triggered)
- Extensive backwards compatibility (pre-1.0 freedom)

❌ **Not production-ready for:**
- Large enterprises requiring locked schemas
- Critical systems where schema changes = downtime
- Teams unable to adapt to occasional breaking changes

### Recommended Approach

**For early adopters:**
1. Pin CLI version in package.json: `"@aligntrue/cli": "0.1.x"`
2. Follow CHANGELOG on each update
3. Test updates in feature branch before rolling out
4. Provide feedback on breaking changes (helps us prioritize stability)
5. Keep rules in Git (easy rollback if needed)

**Update strategy:**
```bash
# Check what changed
git diff package.json  # see new version
cat node_modules/@aligntrue/cli/CHANGELOG.md | head -50

# Test in branch
git checkout -b update-aligntrue
pnpm update @aligntrue/cli
aligntrue validate  # check if rules still valid
git diff .aligntrue/  # see any changes

# If good, merge
git checkout main
git merge update-aligntrue
```

---

## Stability Roadmap

### Current: v0.x (Pre-1.0 Preview)

- Schema: `spec_version: "2-preview"`
- Status: Active development, breaking changes allowed
- Migration: Manual with guides
- Timeline: Phase 1 (CLI-first) - ~3-4 weeks

### Next: v0.9.x (Release Candidate)

- Schema: `spec_version: "2-rc"`
- Status: Feature freeze, bug fixes only
- Migration: Tooling added, no more breaking changes
- Timeline: After 50+ users or 10+ orgs

### Future: v1.0.0 (Stable)

- Schema: `spec_version: "2"`
- Status: Stable, semver guarantees
- Migration: Fully automated with safeguards
- Timeline: When ready (no rushing)

---

## Questions & Answers

### Q: Should I use AlignTrue now or wait for 1.0?

**A:** Use now if you:
- Want immediate benefit from multi-agent rule sync
- Are comfortable with occasional schema updates
- Can provide feedback to shape the 1.0 design

Wait for 1.0 if you:
- Need guaranteed schema stability
- Can't tolerate breaking changes
- Don't want to be an early adopter

### Q: How often will breaking changes happen?

**A:** Goal is < 2 breaking changes between now and 1.0.

We'll bundle related changes together rather than incremental breaks. Each will be well-documented with migration guide.

### Q: Will you grandfather early adopters?

**A:** Yes. When migration tooling ships, it will include migrations for all preview versions. Early adopters won't be left behind.

### Q: Can I help shape the 1.0 design?

**A:** Yes! File issues, join discussions, share your use cases. Early feedback is valuable and welcome.

### Q: What if a breaking change breaks my workflow?

**A:** Contact us immediately. We'll:
1. Understand your use case
2. Provide migration path
3. Consider reverting if impact is severe
4. Learn from feedback to avoid similar issues

---

## Feedback & Support

### Report Issues

- GitHub Issues: [github.com/AlignTrue/aligntrue/issues](https://github.com/AlignTrue/aligntrue/issues)
- Tag with `breaking-change` if related to schema update

### Feature Requests

- GitHub Discussions: [github.com/AlignTrue/aligntrue/discussions](https://github.com/AlignTrue/aligntrue/discussions)
- RFC process for major changes

### Questions

- Tag `question` on GitHub Issues
- Check docs first: [docs](https://github.com/AlignTrue/aligntrue/tree/main/docs)

---

## Related Documents

- [Align Spec v2-preview](../spec/align-spec-v2-cli-first.md) - Current schema specification
- [Package Audit](./package-audit.md) - Why v2 redesign happened
- [Architecture Decisions](./architecture-decisions.md) - Design rationale
- [CHANGELOG](../CHANGELOG.md) - All changes including breaking ones

---

**Summary:** AlignTrue is production-ready for early adopters who value fast iteration over schema stability. Migration tooling comes when we have critical mass of users. Until then, we optimize for learning and improvement.

**Status:** ✅ Pre-1.0 policy documented and active

