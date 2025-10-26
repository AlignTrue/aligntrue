# Archived Components

**Date:** 2025-10-25  
**Reason:** Architectural pivot from catalog-first to CLI-first

---

## What's Here

This directory contains components that were built for Phase 1 (catalog-first approach) but are being deferred to later phases after competitive analysis revealed that CLI-first adoption is more critical.

### Components

**`apps-web/`** - Next.js catalog website
- **Original purpose:** Public catalog for browsing and discovering Align packs
- **Status:** Partially complete (Stage 2.0 done, Stages 2.1-2.3 pending)
- **Deferred to:** Phase 4 (after CLI proves value)
- **Can be revived:** Yes, all code intact
- **Investment:** ~45k tokens

**`apps-docs/`** - Nextra documentation site
- **Original purpose:** Comprehensive documentation at `/docs`
- **Status:** Scaffolded but not populated
- **Deferred to:** Phase 4 (consolidate into CLI help + README for now)
- **Can be revived:** Yes
- **Investment:** ~5k tokens

**`mcp-v1/`** - MCP server package
- **Original purpose:** Model Context Protocol adapter
- **Status:** Empty scaffold only
- **Deferred to:** Phase 2 (after CLI + exporters work)
- **Will rebuild:** Yes, when MCP integration needed
- **Investment:** ~0 tokens (scaffold only)

---

## Why Archived?

Competitive analysis revealed:

1. **Solo developers need CLI first** - Cannot demonstrate value without working tooling
2. **Catalog is discovery, not core** - Sharing can happen via any Git repo initially
3. **Documentation can be simpler** - README + CLI help sufficient for early adopters
4. **MCP can wait** - Prove value with direct exports first

Key insight: **Competitors optimize for ease, we were optimizing for completeness.** Need both, but ease comes first.

---

## What We Kept

**Reused in new architecture:**
- `packages/schema` - Align YAML spec (minor refactoring)
- `packages/checks` - Check engine, SARIF/JSON output (no changes)
- `packages/testkit` - Conformance vectors (no changes)
- `packages/ui` - Design tokens (may use for future catalog)
- `POLICY.md`, `CONTRIBUTING.md` - Governance docs
- All 11 starter packs (converting to markdown examples)

**Net reuse:** ~60% of Phase 1 Track 1 investment

---

## Recovery Plan

### When to Revive

**Catalog website** (`apps-web/`):
- **Trigger:** CLI has 50+ active users, demand for discovery
- **Effort to revive:** ~30k tokens (complete remaining stages)
- **Dependencies:** CLI must be stable and proven

**Documentation site** (`apps-docs/`):
- **Trigger:** Documentation grows beyond README capacity
- **Effort to revive:** ~20k tokens (populate with content)
- **Alternative:** Could use different doc platform by then

**MCP server** (`mcp-v1/`):
- **Trigger:** Users request MCP integration (≥5 requests)
- **Effort to rebuild:** ~15k tokens (thin wrapper over CLI)
- **Dependencies:** CLI commands must be stable

### How to Revive

1. Copy archived component back to workspace
2. Update dependencies to match current versions
3. Integrate with new CLI-first architecture
4. Test with current codebase
5. Update documentation

---

## Lessons Learned

**What went right:**
- Strong foundation (schema, checks, testkit)
- Clear governance model
- Determinism and reproducibility principles

**What we'd change:**
- Start with CLI to prove value
- Make complexity opt-in (lockfiles, bundles)
- Focus on solo dev experience first
- Defer non-essential features

**Key takeaway:** Build the thing users will use daily (CLI), then build the things that help them discover (catalog).

---

## File Inventory

```
archive/
├── README.md                    # This file
├── apps-web/                    # Next.js catalog site
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── next.config.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vercel.json
├── apps-docs/                   # Nextra docs site
│   ├── pages/
│   ├── theme.config.tsx
│   ├── package.json
│   └── tsconfig.json
└── mcp-v1/                      # MCP server scaffold
    ├── src/                     # (empty)
    ├── tests/                   # (empty)
    ├── package.json
    └── tsconfig.json
```

---

## Questions?

See `docs/architecture-decisions.md` and `docs/refactor-plan.md` for full context on the architectural pivot.

**TL;DR:** We're not deleting this work, just deferring it. CLI-first adoption is more important right now.

