# Package Audit: Backwards Compatibility & Catalog-First Assumptions

**Date:** 2025-10-26  
**Context:** Zero users, pre-1.0, refactoring from catalog-first to CLI-first architecture  
**Purpose:** Identify and eliminate backwards compatibility compromises and catalog-first assumptions

---

## Executive Summary

**Critical Finding:** All "kept" packages from Phase 1 Track 1 were designed for catalog-first distribution model. They contain assumptions that add unnecessary complexity for CLI-first solo developers.

**Recommendation:** Selective rebuild approach - keep what's optimal, redesign what's not.

---

## Kept Packages (Phase 1 Track 1)

### packages/schema ⚠️ **REDESIGN REQUIRED**

**Current State:**
- YAML schema designed for catalog distribution
- Validation assumes catalog-style pack structure
- Canonicalization runs on every load/save operation
- Integrity field required in spec (even for solo mode)

**Catalog-First Assumptions Found:**
1. **Pack namespacing:** `id: "packs/base/base-testing"` assumes catalog hierarchy
2. **Profile field:** `profile: "align"` serves no purpose in v1 (reserved for future)
3. **Required integrity:** Forces hash computation even for local-only use
4. **Complex validation:** Ajv strict mode with catalog distribution validation rules

**Problems for CLI-First:**
- Solo devs don't need catalog-style IDs like `packs/org/name`
- Integrity hashing adds overhead for every file operation
- `profile` field is vestigial (planned for "future" that never came)
- Validation complexity designed for untrusted catalog sources

**Recommendation:**
- **REDESIGN** IR schema v2-preview for CLI-first
- Solo mode: Simple IDs, no integrity required, minimal fields
- Team mode: Add provenance, stricter validation
- Catalog mode: Add distribution metadata (Phase 4)
- Move canonicalization to lock/publish only

**Effort:** ~15k tokens (new spec + updated implementation)

---

### packages/checks ✅ **KEEP WITH MINOR SIMPLIFICATION**

**Current State:**
- Five check types: file_presence, path_convention, manifest_policy, regex, command_runner
- SARIF and JSON output
- Clean API, well-tested
- No catalog-specific assumptions

**Analysis:**
- Check types are universally useful (solo, team, catalog)
- API is simple and appropriate for CLI-first
- No unnecessary complexity found
- SARIF output valuable for CI integration

**Minor Issues:**
- command_runner might be over-engineered for P1 (sandbox, timeout, etc.)
- Could defer command_runner to Phase 2 if needed

**Recommendation:**
- **KEEP** with optional simplification
- Consider marking command_runner as "experimental" in P1
- No redesign needed - this package is optimal

**Effort:** 0 tokens (keep as-is) or ~3k tokens (defer command_runner)

---

### packages/testkit ⚠️ **SIMPLIFY REQUIRED**

**Current State:**
- 40 conformance vectors testing Align Spec v1 behaviors
- Tests catalog-specific features: dependency chains, pack resolution
- Golden files use catalog namespacing

**Catalog-First Assumptions Found:**
1. **Dependency chain tests:** Assume catalog-style pack dependencies
2. **Canonicalization edge cases:** Test behaviors only needed for catalog
3. **Pack namespacing:** All examples use `packs/base/...` format
4. **Bundle resolution:** Tests for catalog bundle merging

**Problems for CLI-First:**
- Testing behaviors solo devs don't use
- Old tests may prevent better designs
- Locks in catalog-first decisions

**Recommendation:**
- **SIMPLIFY** to 10-15 core vectors for P1
- Focus on: determinism, solo workflow, markdown round-trips
- Defer catalog tests to Phase 4
- Create new vectors for CLI-first features

**Effort:** ~8k tokens (create CLI-first test vectors)

---

## New Package Designs (Step 2 Scaffolds)

### packages/core ⚠️ **SIMPLIFY DESIGN**

**Current Design:**
- Config, sync engine, scope, bundle, lockfile modules
- All modules scaffolded even though some are team-only

**Issues Found:**
1. **Bundle module in P1:** Solo devs don't need bundle merging
2. **Lockfile complexity:** Designed with migrations in mind
3. **Config schema:** May have team-mode fields exposed in solo mode

**Recommendation:**
- **SIMPLIFY** to core + opt-in modules
- Core: config, sync (IR↔agents)
- Opt-in: lockfile (team mode), bundle (team mode), scope (team mode with monorepos)
- Canonicalization only in lockfile module
- No migration logic

**Effort:** ~5k tokens (simplify module boundaries)

---

### packages/markdown-parser ✅ **GOOD DESIGN**

**Current Design:**
- Extract fenced ```aligntrue blocks
- One block per section rule
- Normalize whitespace before IR conversion

**Analysis:**
- Design is optimal for CLI-first
- No catalog assumptions
- Clean, focused scope

**Recommendation:**
- **KEEP** design as-is
- Implementation in Step 4 proceeds unchanged

**Effort:** 0 tokens

---

### packages/sources ⚠️ **DEFER COMPLEXITY**

**Current Design:**
- Multi-source providers: local, catalog, git, url
- Caching system
- Source resolution and merging

**Issues Found:**
1. **Git source in P1:** Adds complexity, not needed for solo mode
2. **URL source in P1:** Security concerns, minimal value
3. **Multi-source merging:** Team-mode feature exposed in P1

**Recommendation:**
- **SIMPLIFY** to local + catalog only in P1
- Defer git/url sources to Phase 2
- Remove multi-source merging (team mode can use bundle)
- Simplify caching (just for catalog)

**Effort:** ~5k tokens (remove git/url scaffolds)

---

### packages/exporters ✅ **GOOD DESIGN**

**Current Design:**
- Three exporters: Cursor, AGENTS.md, VS Code MCP config
- Hybrid manifest approach (declarative + optional code)
- Security measures (atomic writes, path checks)

**Analysis:**
- Design is appropriate for CLI-first
- Three exporters prove multi-agent value
- No catalog assumptions

**Recommendation:**
- **KEEP** design as-is
- Implementation in Step 11-13 proceeds unchanged

**Effort:** 0 tokens

---

### packages/cli ✅ **GOOD DESIGN**

**Current Design:**
- Commands: init, sync, check, import, migrate (stub)
- Interactive prompts for init
- Git integration modes

**Analysis:**
- Designed for solo dev experience
- Commands are appropriate for P1
- Migrate stub is correct approach

**Recommendation:**
- **KEEP** design as-is
- Add migrate stub as planned
- Implementation proceeds unchanged

**Effort:** 0 tokens

---

## Summary of Recommendations

| Package | Status | Action | Effort | Priority |
|---------|--------|--------|--------|----------|
| schema | ⚠️ REDESIGN | New IR v2-preview spec | ~15k | P0 (blocking) |
| checks | ✅ KEEP | Optional: defer command_runner | ~3k | P2 (optional) |
| testkit | ⚠️ SIMPLIFY | CLI-first vectors only | ~8k | P1 (important) |
| core | ⚠️ SIMPLIFY | Remove bundle/migration complexity | ~5k | P1 (important) |
| markdown-parser | ✅ KEEP | No changes | 0 | - |
| sources | ⚠️ SIMPLIFY | Defer git/url to Phase 2 | ~5k | P1 (important) |
| exporters | ✅ KEEP | No changes | 0 | - |
| cli | ✅ KEEP | Add migrate stub | 0 | - |

**Total cleanup effort:** ~36k tokens (down from original ~383k)  
**Net savings:** Simpler architecture, faster iteration, better DX

---

## Key Insights

### 1. "60% Reuse" Was Sunk Cost Fallacy

The "kept" packages were designed for catalog-first. Treating them as legacy when they were never shipped created unnecessary constraints.

### 2. Canonicalization Everywhere Is Wrong

Current plan has canonicalization on every operation. It should only run when generating lockfiles or publishing to catalog.

### 3. Bundle Complexity Is Team-Only

Solo devs use single source. Bundle merging adds complexity without value for P1 focus.

### 4. Test Vectors Can Lock In Bad Designs

40 testkit vectors test catalog behaviors. They may prevent better CLI-first designs.

---

## Architectural Principles (Revised)

1. **Solo-first:** Design for single developer, local rules, no ceremony
2. **Team features are additive:** Lockfile, bundle, provenance opt-in via team mode
3. **Catalog is Phase 4:** Distribution features deferred, not core
4. **Canonicalize at boundaries:** Only when writing locks or publishing
5. **No migrations until users:** Pre-1.0 preview can break without machinery

---

## Next Steps

1. Design IR schema v2-preview (CLI-first) → `spec/align-spec-v2-cli-first.md`
2. Simplify packages/core (remove bundle/migration complexity)
3. Simplify packages/sources (local + catalog only)
4. Create CLI-first test vectors for packages/testkit
5. Update packages/schema to implement v2-preview

**Priority:** IR schema design is blocking - must complete before Step 3 implementation.

