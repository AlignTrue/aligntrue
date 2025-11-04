# Catalog Management

## Overview

AlignTrue maintains a local catalog of curated packs that seed the catalog website. Packs are stored in `catalog/examples/` and referenced by `catalog/packs.yaml` for discovery metadata.

## Directory structure

```
catalog/
  examples/          # AlignTrue pack YAML files
    global.yaml
    docs.yaml
    typescript.yaml
    testing.yaml
    tdd.yaml
    debugging.yaml
    security.yaml
    rule-authoring.yaml
    nextjs_app_router.yaml
    vercel_deployments.yaml
    web_quality.yaml
  packs.yaml         # Catalog registry with discovery metadata
  namespaces.yaml    # Namespace ownership registry
apps/web/public/catalog/
  index.json         # Generated catalog index
  search_v1.json     # Generated search index
```

## Pack structure

Each pack in `catalog/examples/` follows the AlignTrue IR schema (spec_version "1"):

```yaml
id: "packs/base/base-global"
version: "1.0.0"
profile: "align"
spec_version: "1"
summary: "Short description of pack purpose"
tags: ["tag1", "tag2", "tag3"]
deps: ["packs/base/other-pack"]
scope:
  applies_to: ["*"]
  excludes: ["vendor/**", "node_modules/**"]
rules:
  - id: "rule-name"
    severity: "MUST"
    check:
      type: "command_runner"
      inputs:
        command: "some command"
        expect_exit_code: 0
      evidence: "Human-readable evidence message"
    autofix:
      hint: "How to fix this issue"
integrity:
  algo: "jcs-sha256"
  value: "hash-value"
notes: |
  Additional context for maintainers
guidance: |
  # Extended documentation
  Detailed guidance for AI agents
```

## Catalog registry

`catalog/packs.yaml` contains discovery metadata for each pack:

```yaml
version: "1.0.0"
packs:
  - id: packs/base/base-global
    version: "1.0.0"
    path: catalog/examples/global.yaml
    name: Base Global
    slug: base-global
    description: 2-3 sentence description for catalog display
    summary_bullets:
      - Key feature 1
      - Key feature 2
      - Key feature 3
    categories:
      - foundations
      - code-quality
    tags:
      - baseline
      - essential
      - determinism
    compatible_tools:
      - cursor
      - claude-code
      - github-copilot
      - cody
      - continue
    license: CC0-1.0
    maintainer:
      name: AlignTrue
      github: aligntrue
    source_repo: https://github.com/AlignTrue/aligntrue
    namespace_owner: AlignTrue
```

## Category taxonomy

### Primary Categories (for filtering)

- **foundations** - baseline packs everyone needs
- **code-quality** - language-specific and code standards
- **development-workflow** - process and workflow packs
- **frameworks** - framework-specific packs
- **infrastructure** - deployment and infra packs
- **security** - security and compliance packs
- **performance** - performance and web vitals packs

### Secondary Tags (cross-cutting)

- `baseline` - essential starting packs
- `paved-road` - opinionated best practices
- `determinism` - deterministic behavior focus
- `testing` - test-related
- Language/framework tags: `typescript`, `nextjs`, `react`, etc.

## Namespace ownership

`catalog/namespaces.yaml` prevents namespace squatting:

```yaml
version: "1.0.0"
updated_at: "2025-10-31T00:00:00.000Z"
namespaces:
  - namespace: "packs/base/*"
    owner: "AlignTrue"
    notes: "Core base packs"
  - namespace: "packs/stacks/*"
    owner: "AlignTrue"
    notes: "Framework and platform-specific packs"
```

## Building the Catalog

### Quick Build (Simplified)

```bash
cd /Users/gabe/Sites/aligntrue
node temp-build-catalog.mjs
```

This generates:

- `apps/web/public/catalog/index.json` - Full catalog with pack metadata
- `apps/web/public/catalog/search_v1.json` - Search index for Fuse.js

### Full Build (With Validation)

When `scripts/catalog/build-catalog.ts` dependencies are available:

```bash
cd /Users/gabe/Sites/aligntrue
node scripts/catalog/build-catalog.ts
```

This performs:

1. Schema validation for each pack
2. Abuse controls (size, binaries)
3. Namespace ownership validation
4. Exporter preview generation
5. Catalog index generation

## Adding a New Pack

1. **Create pack YAML** in `catalog/examples/`:
   - Follow AlignTrue IR schema (spec_version "1")
   - Include id, version, profile, summary, scope, rules
   - Add integrity hash (JCS-SHA256)
   - Write actionable guidance section

2. **Add catalog entry** to `catalog/packs.yaml`:
   - Provide discovery metadata (name, slug, description)
   - Choose appropriate categories and tags
   - List compatible_tools
   - Verify namespace_owner matches `catalog/namespaces.yaml`

3. **Verify namespace** in `catalog/namespaces.yaml`:
   - Ensure namespace exists for pack id prefix
   - Add new namespace if needed with owner proof

4. **Build catalog**:

   ```bash
   node temp-build-catalog.mjs
   ```

5. **Test**:
   ```bash
   cd apps/web
   pnpm dev
   # Navigate to http://localhost:3000/catalog
   # Verify pack appears in catalog
   # Test search and filters
   ```

## Mirroring to External Repo

Packs can optionally be mirrored to a separate repo (e.g., `AlignTrue/aligns`) for external contributions while keeping the source of truth local for faster builds and testing.

## Catalog website

The catalog website (`apps/web`) consumes the generated JSON files:

- **Homepage** (`/`) - Quickstart and featured packs
- **Catalog** (`/catalog`) - Full pack listing with search and filters
- **Detail** (`/catalog/[slug]`) - Individual pack details with install instructions

### Features

- **Search** - Fuse.js fuzzy search across name, description, tags
- **Filters** - Categories, tags, compatible tools
- **Install** - Copy-pasteable `aln pull` commands
- **Share** - Pack URLs for sharing
- **Analytics** - Privacy-focused event tracking (8 event types)

## Testing

```bash
cd apps/web
pnpm test
```

Current status: **232/269 tests passing** (86%)

Failing tests are mostly related to async Server Component rendering and can be addressed in follow-up work.

## Schema validation

All packs must conform to AlignTrue IR schema (spec_version "1"). Validation includes:

- Required fields (id, version, profile, spec_version, summary)
- Scope structure (applies_to, includes, excludes)
- Rules structure (id, severity, check, evidence)
- Integrity hash format (algo, value)

## Performance

- **Catalog index size**: ~100 KB for 11 packs
- **Search index size**: ~50 KB for 11 packs
- **Build time**: <5 seconds for 11 packs

## Future enhancements

- Full validation with schema checks
- Exporter preview generation for all formats
- Usage analytics integration
- Real user stats (copies_7d)
- Abuse controls for pack size and content
