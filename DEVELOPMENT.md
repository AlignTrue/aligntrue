<!--
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY

  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files

  Source: apps/docs/content/08-development/*.md
-->

# Development Guide

> This guide is auto-generated from the AlignTrue documentation site.

## Table of Contents

- [Architecture](#architecture)
- [Archiving components checklist](#archiving-components-checklist)
- [Preventing CI failures](#preventing-ci-failures)
- [Development commands](#development-commands)
- [Dependabot auto-merge strategy](#dependabot-auto-merge-strategy)
- [Package exports](#package-exports)
- [Release process](#release-process)
- [Development setup](#development-setup)
- [Test maintenance: Core format and path changes](#test-maintenance-core-format-and-path-changes)
- [Workspace structure](#workspace-structure)

---

# Architecture

Key architectural concepts and design principles for AlignTrue.

## Core principles

1. **Maintainability** – Prefer explicit modules and shallow trees so AI can reason about the code
2. **Determinism** – YAML → Type-safe model → JCS canonical JSON → SHA-256 hashes
3. **Simplicity** – Small, predictable modules; no registries, no plugin magic
4. **Local-first** – All useful flows run offline; cloud augments later
5. **Agent parity** – Exporters preserve semantics and emit fidelity notes when they cannot
6. **Advisory-first** – Validators explain before they block

## Data flow

AlignTrue follows an IR-first (Intermediate Representation) architecture:

```
Source (YAML/Markdown)
  ↓
IR (Intermediate Representation)
  ↓
Canonical JSON (JCS) + SHA-256 Hash
  ↓
Agent Exports (.mdc, AGENTS.md, MCP configs, etc.)
```

### IR-first design

- `.aligntrue/.rules.yaml` (IR) is the canonical source, not bundles
- Natural markdown sections compile to IR
- All operations work on IR directly
- Canonicalization only at lock/publish boundaries

### Two-way sync

- Default: IR → agents (export rules to agent files)
- Optional: agent → IR (pull changes back from agent files)
- `--accept-agent` flag enables explicit pullback
- Auto-pull enabled by default for seamless workflows

## Determinism

### When to canonicalize

**Only canonicalize when determinism is required:**

- **Lockfile generation** (`aligntrue lock` in team mode) - Produce canonical hash for drift detection
- **Catalog publishing** (`aligntrue publish` - removed from roadmap) - Produce integrity hash for distribution
- **NOT during:** init, sync, export, import, normal file operations

**Why:**

- Solo devs don't need canonicalization overhead for local files
- Team mode only needs determinism for lockfile-based drift detection
- Catalog publishing needs integrity hash at distribution boundary
- Running canonicalization on every operation adds unnecessary cost

### Implementation

- `packages/schema/src/canonicalize.ts` contains JCS canonicalization logic
- `packages/core/src/lockfile.ts` calls canonicalize when generating locks
- Exporters do NOT canonicalize; they work with IR directly
- All hashing uses `packages/schema/src/hashing.ts`

## Package architecture

### Stable modules (deterministic logic)

Keep these modules consolidated and deterministic:

- `packages/schema/src/canonicalize.ts` – YAML → canonical JSON (JCS)
- `packages/schema/src/hashing.ts` – SHA-256 integrity hashing
- `packages/schema/src/validator.ts` – IR validation with Ajv strict mode
- `packages/core/src/config.ts` – Config parsing and validation
- `packages/core/src/sync.ts` – Two-way sync engine (IR ↔ agents)
- `packages/core/src/bundle.ts` – Dependency merge + precedence (team mode)
- `packages/core/src/lockfile.ts` – Lockfile generation with canonical hashing
- `packages/core/src/scope.ts` – Hierarchical scope resolution

### Adaptation layers (agent-specific)

These adapt core logic to specific surfaces:

- `packages/cli/src/commands/*` – CLI command implementations
- `packages/exporters/src/*/exporter.ts` – Agent-specific exports

## Vendor bags

Vendor bags enable lossless round-trips for agent-specific metadata:

- `vendor.<agent>` namespace for agent-specific extensions
- `vendor.*.volatile` excluded from hashing (timestamps, session IDs, etc.)
- Preserved during sync operations
- Allows agents to store additional metadata without breaking AlignTrue semantics

Example:

```yaml
vendor:
  cursor:
    session_id: "abc123" # Volatile, excluded from hash
    preferences:
      theme: "dark" # Stable, included in hash
```

## Hierarchical scopes

Path-based rules with merge order for monorepos:

1. Root scope (applies everywhere)
2. Directory scopes (applies to subtree)
3. File-level overrides (most specific)

Rules merge with precedence from most specific to least specific.

## Team mode features

### Lockfiles

- Enable with `mode: team` in config
- Generated with `aligntrue lock`
- Pin exact versions and hashes
- Detect drift in CI with `aligntrue check`

### Bundles

- Merge dependencies and rules
- Resolve conflicts with precedence rules
- Generate once, track in git
- Enable reproducible builds

### Drift detection

- Compare current state against lockfile
- Report changes to rules, versions, or hashes
- Fail CI if drift detected (configurable severity)

## Exporters

AlignTrue includes 43 exporters supporting 28+ agents:

### Categories

1. **MCP config exporters** - JSON configs for Model Context Protocol agents
2. **Agent-specific formats** - Native formats (.mdc, .yml, .json, etc.)
3. **Universal formats** - AGENTS.md for broad compatibility
4. **Dual-output** - Both universal + specific (e.g., Aider)

### Fidelity notes

Each exporter documents what information may be lost when converting from IR:

- Computed by exporter
- Returned in `ExportResult.fidelityNotes`
- Displayed in CLI output during sync
- Help users understand limitations
- Guide decisions about which exporters to use

### Content hash

- Computed deterministically from IR sections
- Returned in `ExportResult.contentHash`
- Useful for drift detection and integrity verification
- Not written to exported files (files kept clean)
- For MCP config exporters, hash is included in JSON as `content_hash` field

## AI-maintainable code principles

### 1. Explicit over dynamic

```ts
// Good: Explicit dispatch
switch (target) {
  case "cursor":
    return exportCursor(bundle);
  case "codex":
    return exportCodex(bundle);
}

// Bad: Dynamic lookup
const exporters = { cursor: exportCursor, codex: exportCodex };
return exporters[target](bundle);
```

### 2. Flat over nested

Max depth three. Modules at `packages/*/src/` with minimal nesting.

### 3. Consolidated complexity

Keep deterministic logic together up to ~800 LOC. Split only when boundaries are obvious.

### 4. Clear data flow

Good: CLI command → schema service → exporter  
Bad: CLI → orchestrator → factory → plugin host → exporter

### 5. Deterministic schema validation

Single JSON Schema (2020-12) exported from `packages/schema`. Use Ajv strict mode everywhere.

### 6. Finish refactors

If you start moving logic, finish in the same PR or leave a `_legacy.ts` file with owner + removal date.

## Testing philosophy

- Unit tests for all core logic
- Integration tests for CLI commands
- Golden tests for determinism
- Contract tests for exporters
- No real time, network, or randomness in tests
- Match CI environment exactly (TZ=UTC)

## Workspace organization

This architecture translates to a clean pnpm monorepo:

```
aligntrue/
├── packages/
│   ├── schema/           # IR validation, canonicalization, hashing
│   ├── plugin-contracts/ # Plugin interfaces
│   ├── file-utils/       # Shared utilities
│   ├── core/             # Config, sync engine, bundle/lockfile
│   ├── sources/          # Multi-source pulling (local, git)
│   ├── exporters/        # Agent-specific exports (43 adapters)
│   ├── cli/              # aligntrue/aln CLI
│   ├── testkit/          # Conformance vectors and golden tests
│   └── ui/               # Design system components
├── apps/
│   └── docs/             # Nextra documentation site
├── examples/             # Example configurations
├── catalog/              # Curated rule packs
└── scripts/              # Build and setup scripts
```

**Design principles applied to structure:**

- Max depth 3: packages at `packages/*/src/` with minimal nesting
- Stable deterministic logic consolidated in `schema/` and `core/`
- Agent adapters thin and isolated in `exporters/`
- CLI is the top-level surface in Phase 1

## Security considerations

- No outbound network calls in core path
- Telemetry opt-in via env var (off by default)
- Never log secrets or PII
- Never commit real tokens
- Atomic file writes prevent corruption
- Sandbox execution for command runners

## Published packages

All packages are published under the `@aligntrue` scope:

- `@aligntrue/schema` - IR validation and types
- `@aligntrue/plugin-contracts` - Plugin interfaces
- `@aligntrue/file-utils` - Shared utilities
- `@aligntrue/core` - Config and sync engine
- `@aligntrue/sources` - Multi-source pulling
- `@aligntrue/exporters` - Agent adapters
- `@aligntrue/cli` - Command-line tool
- `@aligntrue/testkit` - Test utilities

**Shim package:**

- `aligntrue` - Depends on `@aligntrue/cli` for easy installation

**Install:**

```bash
npm i -g @aligntrue/cli@next   # Alpha
npm i -g aligntrue             # Stable
```

## Developer workflow

### Schema or sections format changes

Update schema + CLI + exporters in the same PR:

1. Extend shared package types (e.g., `packages/schema/src/types.ts`)
2. Update CLI command handlers
3. Update exporter adapters
4. Add contract tests in `schema/tests/`
5. Add integration tests in `cli/tests/`
6. Update docs and CHANGELOG

### Adding new exporters

Create a new exporter in `packages/exporters`:

1. Add exporter implementation with manifest
2. Add contract tests
3. Update `packages/exporters/src/index.ts` to export it
4. Update CLI to include new exporter
5. Add docs explaining the exporter
6. Update CHANGELOG

### Avoiding cloud features

Cloud features stay in the cloud repo, never imported here. Keep this repo focused on:

- Local-first workflows
- Deterministic bundling
- CI validation
- Open-source tooling

## CI gates and quality checks

- **Bundle size:** CLI tarball must stay under 600 KB
- **Pack vendoring:** Pack files must not be vendored in CLI
- **Schema changes:** IR format changes require version bump + changelog
- **Determinism:** Tests run with `TZ=UTC` to match CI environment
- **Type checking:** Full typecheck across all packages on pre-push
- **Tests:** All tests must pass on all packages
- **Build:** Full production build must succeed

**Testing environment:**

Run tests locally with CI environment variables:

```bash
TZ=UTC pnpm test
```

This ensures determinism matches CI exactly.

## Next steps

- Review [workspace structure](https://aligntrue.ai/docs/08-development/workspace)
- Explore [development commands](https://aligntrue.ai/docs/08-development/commands)
- See [setup guide](https://aligntrue.ai/docs/08-development/setup) for installation

---

# Archiving components checklist

This checklist prevents issues like the transpile validation CI failure that occurred when `apps/web` was archived but scripts still referenced it.

## When to use

Follow this checklist when moving any component (app, package, or major module) to the `archive/` directory.

## Pre-archive checklist

### 1. Search for references

Search the entire codebase for references to the component being archived:

```bash
# Replace "path/to/component" with the actual path
grep -r "path/to/component" scripts/
grep -r "path/to/component" .github/workflows/
grep -r "path/to/component" package.json
grep -r "path/to/component" pnpm-workspace.yaml
```

**Example (archiving apps/web):**

```bash
grep -r "apps/web" scripts/
grep -r "apps/web" .github/workflows/
grep -r "apps/web" package.json
```

### 2. Update or remove scripts

For each script that references the archived component:

- **Delete if component-specific** - Script only exists for the archived component
- **Add existsSync() guards** - Script handles multiple components, some archived
- **Update paths** - Component relocated but still active

**Example (validation script with guard):**

```javascript
const configPath = join(rootDir, "apps/web/next.config.ts");
const config = existsSync(configPath) ? loadConfig(configPath) : null;

if (config !== null) {
  // Validate active component
} else {
  console.log("📦 apps/web (skipped - archived)");
}
```

### 3. Test affected scripts

Run all scripts that might be affected:

```bash
# Run validation scripts
node scripts/validate-*.mjs

# Build packages
pnpm build:packages

# Run tests
pnpm test
```

### 4. Update CI workflow

Check `.github/workflows/` for steps that reference the archived component:

- Remove build steps for archived apps
- Remove deployment steps for archived apps
- Remove test steps specific to archived component
- Update validation steps to skip archived components

### 5. Update package configuration

Check and update:

- `package.json` - Remove scripts referencing archived component
- `pnpm-workspace.yaml` - Remove archived workspace paths
- `tsconfig.json` - Remove path mappings to archived component
- `vercel.json` - Remove rewrites/redirects to archived apps

### 6. Document in CHANGELOG

Add entry explaining:

- What was archived and why
- When it was archived
- Migration path (if applicable)
- Restoration triggers (if applicable)

**Example:**

```markdown
### Archived

- **apps/web (Catalog website)** - Archived to simplify pre-launch. Static catalog page in docs site replaces it. Restoration triggers: 50+ active users OR 20+ curated packs.
```

### 7. Update future features documentation

Document the archived feature with:

- What was built and why it was archived
- Current approach or workaround
- Clear restoration triggers (objective, measurable)
- Estimated restoration effort
- Implementation notes for future restoration

## Post-archive verification

### 1. Local validation

```bash
# Ensure all validation scripts pass
node scripts/validate-ui-tsconfig.mjs
node scripts/validate-transpile-packages.mjs

# Build all active packages
pnpm build:packages

# Run test suite
pnpm test

# Check for untracked files created by scripts
git status
```

### 2. CI validation

Push to a feature branch and verify:

- All CI jobs pass
- No references to archived component in logs
- Build completes successfully
- Tests pass on all platforms

### 3. Documentation review

Verify documentation is updated:

- CHANGELOG.md has archive entry
- Future features doc has restoration guide
- Development docs reference current structure
- README (if applicable) updated

## Common pitfalls

### Hardcoded paths

**Problem:** Scripts assume directory structure without checking existence

**Solution:** Always use `existsSync()` before accessing paths

```javascript
// BAD
const config = readFileSync(configPath);

// GOOD
if (existsSync(configPath)) {
  const config = readFileSync(configPath);
}
```

### Validation scripts

**Problem:** Validators check archived components and fail

**Solution:** Skip archived components gracefully with clear messaging

```javascript
if (!existsSync(componentPath)) {
  console.log(`📦 ${componentName} (skipped - archived)`);
  continue;
}
```

### Build scripts

**Problem:** Build scripts create archived directories

**Solution:** Delete component-specific build scripts, update paths in shared scripts

### CI workflows

**Problem:** CI runs steps for archived components

**Solution:** Remove archived component steps from workflow files

## Example: Archiving apps/web

This real example shows the process:

1. **Search:** Found references in `scripts/catalog/build-catalog.ts`, `scripts/validate-transpile-packages.mjs`, `scripts/validate-ui-tsconfig.mjs`

2. **Update:**
   - Deleted `scripts/catalog/build-catalog.ts` (component-specific)
   - Updated `validate-transpile-packages.mjs` with existsSync() guard
   - Verified `validate-ui-tsconfig.mjs` already had guards

3. **Test:** Ran all validation scripts and build - passed ✅

4. **CI:** Verified no CI steps reference apps/web - clean ✅

5. **Document:**
   - Added CHANGELOG entry
   - Updated future features doc with restoration triggers
   - Created this checklist

6. **Verify:** Pushed to CI, all checks passed ✅

## Related documentation

- [CI failure prevention](https://aligntrue.ai/docs/08-development/ci-failures)
- [Development setup](https://aligntrue.ai/docs/08-development/setup)
- [CHANGELOG](/CHANGELOG.md)

---

# Preventing CI failures

This guide explains the validation workflow and tools designed to catch errors early and prevent CI failures.

## Overview

AlignTrue uses a multi-layered validation approach:

1. **Pre-refactor validation** - Run before large changes to ensure clean baseline
2. **Pre-commit hook** - Incremental checks on every commit (fast, focused)
3. **CI validation** - Full workspace validation on push (comprehensive)

## Pre-refactor validation

Use before large refactors, type changes, or cross-package edits.

```bash
pnpm pre-refactor
```

**What it does:**

- Type checks entire workspace (~30-60s)
- Lints entire workspace
- Ensures clean baseline before starting work

**When to use:**

- Before refactoring 3+ files
- Before changing shared types or interfaces
- Before cross-package changes
- When you see repeated CI failures

## Pre-commit hook (automatic)

Runs automatically on every `git commit`. Optimized for speed with incremental checks.

**Flow:**

1. **Format** staged files with Prettier (~5s)
2. **Validate protected repo files** - Prevent direct edits to auto-generated files
3. **Quick typecheck** changed packages only (~5-15s) ← **Fails fast**
4. **Build** changed packages (~15-30s)
5. **Full typecheck** changed packages (~10-20s)

**Total time:** 30-60s for typical commits (vs 2+ min previously)

**Key improvements:**

- Catches type errors BEFORE build (saves time)
- Only checks/builds changed packages (faster)
- Shows clear error messages with fix suggestions
- Suggests `pnpm pre-refactor` for large changes
- **Prevents direct edits to auto-generated files** (new)

### Protected repository files

The following files are auto-generated from documentation source and cannot be directly edited:

- `README.md` (generated from `apps/docs/content/index.mdx`)
- `CONTRIBUTING.md` (generated from `apps/docs/content/05-contributing/creating-packs.md`)
- `DEVELOPMENT.md` (generated from `apps/docs/content/07-development/*`)

**Why:** AlignTrue practices what it preaches - documentation is the IR (Intermediate Representation), and generated files are the exports. This enforces the docs-first architecture.

**Correct workflow:**

1. Edit the canonical source in `apps/docs/content/`
2. Run `pnpm generate:repo-files` to regenerate root files
3. Commit both the doc changes AND the regenerated files

**If you accidentally try to directly edit a protected file:**

```
❌ Protected files were directly edited

📝 These files are generated from docs content:
   README.md
   CONTRIBUTING.md
   DEVELOPMENT.md

🔄 Correct workflow:
   1. Edit source files in apps/docs/content/
   2. Run: pnpm generate:repo-files
   3. Commit both docs changes AND generated files
```

**To fix:** Follow the workflow above and retry your commit.

### Bypassing the hook

Only use `--no-verify` when absolutely necessary (e.g., emergency hotfix, known CI issue):

```bash
git commit --no-verify -m "fix: Emergency hotfix"
```

## CI validation (automatic)

Runs on every push to `main` or `develop`. Comprehensive validation of entire workspace.

**What CI checks:**

1. Lockfile sync validation
2. Full workspace build
3. Full workspace typecheck
4. All tests (unit + integration)
5. Conformance testkit
6. Golden repository validation

**Time:** 3-5 minutes

## Common type error patterns

### 1. Import path errors

**Problem:** Wrong import path or missing type export

```typescript
// ❌ Wrong
import { DriftDetectionResult } from "@aligntrue/core/team/drift.js";

// ✅ Correct
import { DriftResult } from "@aligntrue/core/team/drift.js";
```

**Fix:** Check the actual exports in the source file

### 2. Duplicate imports

**Problem:** Same type imported from multiple locations

```typescript
// ❌ Wrong
import { AlignRule } from "@aligntrue/core";
import { AlignRule } from "@aligntrue/schema";

// ✅ Correct
import { AlignRule } from "@aligntrue/schema";
```

**Fix:** Import types from their canonical source (usually `@aligntrue/schema`)

### 3. Type narrowing issues

**Problem:** TypeScript can't infer type after conditional

```typescript
// ❌ Wrong
if (!acc[item.category]) acc[item.category] = [];
acc[item.category].push(item); // Error: possibly undefined

// ✅ Correct
if (!acc[item.category]) acc[item.category] = [];
acc[item.category]!.push(item); // Non-null assertion
```

**Fix:** Use non-null assertion (`!`) or type guards

### 4. exactOptionalPropertyTypes issues

**Problem:** Optional property can't be explicitly set to `undefined`

```typescript
// ❌ Wrong
type Result = {
  summary?: string;
};

// ✅ Correct
type Result = {
  summary?: string | undefined;
};
```

**Fix:** Explicitly allow `undefined` in optional properties

## Import path reference

Common type locations:

- **Schema types:** `@aligntrue/schema`
  - `AlignRule`, `AlignPack`, `validateAlignSchema`, `validateRuleId`
- **Core types:** `@aligntrue/core`
  - `AlignTrueConfig`, `SyncEngine`, `BackupManager`
- **Team types:** `@aligntrue/core/team/drift.js`
  - `DriftResult`, `DriftFinding`, `DriftCategory`
- **Exporter types:** `@aligntrue/exporters`
  - `ExporterRegistry`, `ExportResult`

- **Source types:** `@aligntrue/sources`
  - `GitSourceConfig`, `CatalogSourceConfig`

## Troubleshooting

### Next.js dev server fails with "Cannot find module" errors

**Symptom:** Dev server crashes with errors like:

```
Error: Cannot find module './vendor-chunks/nextra@4.6.0...'
Cannot find module '@aligntrue/ui'
```

**Cause:** Next.js doesn't transpile workspace packages by default. The `@aligntrue/ui` package exports TypeScript source directly (no build step), so Next.js needs to be configured to transpile it.

**Fix:**

1. Check your Next.js config has `transpilePackages`:

```typescript
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ["@aligntrue/ui"],
  // ... rest of config
};
```

```javascript
// apps/docs/next.config.mjs
export default withNextra({
  transpilePackages: ["@aligntrue/ui"],
  // ... rest of config
});
```

2. Clean stale build caches:

```bash
rm -rf apps/web/.next apps/docs/.next
```

3. Restart dev servers:

```bash
pnpm dev:web   # or pnpm dev:docs
```

**Prevention:**

The CI now validates `transpilePackages` config matches workspace dependencies:

```bash
pnpm validate:transpile-packages
```

This runs automatically in CI to catch config drift. If you add a new workspace package that exports TypeScript source, add it to `transpilePackages` in both Next.js configs.

### Pre-commit hook is slow

**Cause:** Checking too many packages or full workspace

**Fix:** The optimized hook only checks changed packages. If still slow:

1. Check if you have uncommitted changes in many packages
2. Run `pnpm pre-refactor` first to catch issues early
3. Commit packages separately if working on multiple

### Type errors only appear in CI

**Cause:** Local build is stale or using cached types

**Fix:**

```bash
# Clean and rebuild
pnpm clean
pnpm build

# Then run typecheck
pnpm typecheck
```

### Pre-commit hook fails but types seem fine

**Cause:** Hook uses stricter checks than your IDE

**Fix:**

1. Run `pnpm typecheck` locally to see all errors
2. Check that your IDE is using workspace TypeScript version
3. Ensure `tsconfig.json` has `strict: true`

## Best practices

1. **Run `pnpm pre-refactor` before large changes** - Catches issues before you start
2. **Commit frequently** - Smaller commits = faster pre-commit checks
3. **Fix type errors immediately** - Don't let them accumulate
4. **Use the right import paths** - Check source files for canonical exports
5. **Test locally before pushing** - Run `pnpm typecheck && pnpm test`

---

CI now runs a series of fail-fast checks. When one of them fails, look for the matching error message below.

## Workspace protocol validation failed

**Symptom**

```
Workspace protocol validation failed: @aligntrue/core version is "^0.2.0".
```

**Fix**

1. Run `pnpm validate:workspace` locally.
2. Update the dependency to `workspace:*` in the referenced `package.json`.
3. Re-run `pnpm install && pnpm build:packages`.

## Workspace link verification failed

**Symptom**

```
Workspace link verification failed: @aligntrue/cli → /node_modules/.pnpm/...
```

**Fix**

1. Ensure you ran `pnpm install` after switching branches.
2. If links still resolve to `.pnpm`, run `pnpm clean && pnpm install`.
3. Re-run `pnpm verify:workspace-links`.

## Version mismatch during prepublish

**Symptom**

```
Versions must match across all workspace packages.
```

**Fix**

1. Run `pnpm prepublish:check` locally; it prints every mismatched package.
2. Bump all packages to the same version (for example, 0.2.0) before releasing.

## Type mismatch after renaming formats

**Symptom**

```
TS2322: Type '"agents"' is not assignable to type '"agents-md"'.
```

**Fix**

1. Ensure packages were rebuilt: `pnpm build:packages`.
2. Run `pnpm validate:workspace` and `pnpm verify:workspace-links`.
3. If CI still fails, run `pnpm clean && pnpm install` to refresh workspace links.

---

# Development commands

Common commands and workflows for AlignTrue development.

## Core commands

### Run docs locally

```bash
pnpm dev
```

Starts the documentation site at `http://localhost:3000` (from `apps/docs`)

### Build all packages

```bash
pnpm build
```

### Run tests

```bash
pnpm test        # All tests across all packages
pnpm test:fast   # Fast reporter for quick feedback
```

### Type-check all packages

```bash
pnpm typecheck
```

### Format

```bash
pnpm format        # Format code with Prettier
pnpm format:check  # Check formatting without changes
```

### Validation workflow

Run before large refactors to ensure clean baseline:

```bash
pnpm pre-refactor  # Type check + lint entire workspace
```

### Clean

```bash
# Remove all node_modules and build artifacts
pnpm clean

# Remove temp files created by AI/debugging
pnpm clean-temp
```

## Working on packages

### Package build workflow

When editing workspace packages that other packages depend on (core, schema, exporters), you have two options:

**Option 1: Watch mode (recommended for active development)**

Run packages in watch mode for automatic rebuilds on save:

```bash
pnpm dev:packages
```

This runs all packages in parallel watch mode. Keep this running in a separate terminal while developing.

**Option 2: Manual builds**

Build packages explicitly when needed:

```bash
# Build all packages
pnpm build:packages

# Build specific package
pnpm --filter @aligntrue/core build
```

### Why builds matter

Packages import from `dist/` directories of their dependencies (e.g., CLI imports from `packages/core/dist/`). If you edit source in `packages/core/src/` but don't rebuild, other packages will see stale types and code.

**The pre-commit hook automatically rebuilds packages when source files change**, so you won't commit stale builds. But during development, use watch mode for instant feedback.

### Working with type changes

When you change exported types in core packages (schema, core, exporters, plugin-contracts):

1. Build the package: `pnpm --filter @aligntrue/schema build`
2. Turbo automatically rebuilds dependent packages

Or just run `pnpm build:packages` to rebuild everything. Turbo's dependency graph ensures packages build in the correct order.

### Workspace protocol and release checks

- All `@aligntrue/*` dependencies must use `workspace:*` so local builds always take priority. Run `pnpm validate:workspace` if you edit `package.json`.
- After `pnpm install`, run `pnpm verify:workspace-links` when diagnosing type mismatches. It ensures node_modules links resolve to local workspace packages.
- Before publishing, run `pnpm prepublish:check`. It verifies versions match across packages, the git tree is clean, and build/typecheck/test succeed.
- CI runs the same checks in `.github/workflows/ci.yml`, so keeping them green locally prevents “works on my machine” releases.

## Running tests locally

### All tests

Run the full test suite across all packages:

```bash
pnpm test
```

### Specific package

Test a single package:

```bash
pnpm --filter @aligntrue/cli test
pnpm --filter @aligntrue/schema test
pnpm --filter @aligntrue/core test
```

### Specific test file

Run a specific test file:

```bash
pnpm --filter @aligntrue/cli vitest run tests/commands/sync.test.ts
```

### Watch mode

Run tests in watch mode for rapid feedback during development:

```bash
# Watch all tests in a package
pnpm --filter @aligntrue/cli vitest

# Watch specific test file
pnpm --filter @aligntrue/cli vitest tests/commands/sync.test.ts

# Watch with UI
pnpm --filter @aligntrue/cli vitest --ui
```

### With coverage

Generate coverage reports:

```bash
pnpm --filter @aligntrue/cli vitest --coverage
```

### Deterministic test environment

Match CI environment exactly (useful for debugging CI failures):

```bash
TZ=UTC pnpm test
```

### Fast feedback mode

Use the fast reporter for quicker output:

```bash
pnpm test:fast
```

## Design system and theming

AlignTrue uses a centralized design system (`@aligntrue/ui`) for consistent branding across all web properties.

### Key components

- **AlignTrueLogo** - SVG logo with theme-aware colors and orange colon (#F5A623)
- **Primer-based colors** - Semantic tokens that adapt to light/dark modes

### Using the design system

Import components and styles in your Next.js app:

```tsx
import { AlignTrueLogo } from "@aligntrue/ui";
import "@aligntrue/ui/styles/tokens.css";
```

### Color tokens

Use semantic color tokens instead of hardcoded colors:

```tsx
// Good - adapts to theme
<div style={{ color: "var(--fgColor-default)" }}>Text</div>

// Bad - hardcoded, breaks in dark mode
<div style={{ color: "#171717" }}>Text</div>
```

Available token categories:

- `--fgColor-*` - Foreground/text colors
- `--bgColor-*` - Background colors
- `--borderColor-*` - Border colors
- `--color-neutral-*` - Neutral scale (50-950)

See [workspace structure](https://aligntrue.ai/docs/08-development/workspace) for complete documentation.

### Testing themes

Test both light and dark modes during development:

1. Use the theme toggle in the UI
2. Check browser DevTools → Application → Local Storage for `aligntrue-theme`
3. Toggle system preference in OS settings to test "system" mode
4. Verify no FOUC (flash of unstyled content) on page load

### Nextra documentation sites

For Nextra-based docs, import Nextra's base styles and configure your `apps/docs/theme.config.tsx` directly:

```tsx
import "nextra-theme-docs/style.css";
import type { DocsThemeConfig } from "nextra-theme-docs";
import { AlignTrueLogo } from "@aligntrue/ui";

const themeConfig: DocsThemeConfig = {
  logo: <AlignTrueLogo size="md" />,
  docsRepositoryBase: "https://github.com/org/repo/tree/main/apps/docs",
  navigation: true,
};

export default themeConfig;
```

This provides:

- Branded logo via the shared `AlignTrueLogo` component
- Consistent sidebar and TOC configuration
- Nextra's built-in theme system for colors

## Code quality

### TypeScript

- All packages use strict TypeScript
- Extends `tsconfig.base.json` from repo root
- No `any` types allowed
- Use `unknown` and narrow types

### Formatting

EditorConfig is configured at the root. Use:

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding

### Testing

- Unit tests go in `packages/*/tests/`
- Keep tests fast (<1s per test)
- Make tests deterministic (no real time, network, or randomness)

## Common tasks

### Add a new package

1. Create directory under `packages/`
2. Add `package.json` with workspace dependencies
3. Create `tsconfig.json` extending base
4. Add to workspace commands in root `package.json`

### Update dependencies

```bash
pnpm update --latest --recursive
```

### Check for security issues

```bash
pnpm audit
```

## Versioning with Changesets

We use Changesets for managing package versions and changelogs.

### Creating a changeset

After making changes, create a changeset describing your changes:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select which packages changed
2. Choose version bump type (major/minor/patch)
3. Write a summary of changes

The changeset file will be committed with your changes.

### Versioning packages

To consume changesets and bump versions:

```bash
pnpm version
```

This updates `package.json` versions and `CHANGELOG.md` files.

### Publishing packages

After versioning, publish to npm:

```bash
pnpm release
```

This builds all packages and publishes them to npm.

## CI/CD

CI runs on every PR:

- Lockfile sync validation
- `pnpm typecheck` - Type checking
- `pnpm test` - Tests
- `pnpm build` - Production build
- Integration tests
- Golden repository validation

All must pass before merge.

**Note:** Pre-push hooks mirror CI checks, so if pre-push passes, CI should pass too.

## Troubleshooting

### Pre-commit hook fails with formatting errors

The hook auto-formats code with Prettier. If it still fails, check the error output for issues with the lockfile update or other problems.

### Pre-push hook is too slow

Pre-push runs the full validation suite (~30-60 seconds). This is intentional to catch issues before CI.

For faster iteration during development, use watch mode for tests instead of relying on hooks.

### Commit message rejected

Ensure your commit message follows Conventional Commits format:

```bash
<type>: <description>
```

Example: `feat: Add new command` or `fix: Resolve memory leak`

## Next steps

- Review [workspace structure](https://aligntrue.ai/docs/08-development/workspace)
- Understand [architecture concepts](https://aligntrue.ai/docs/08-development/architecture)
- See [setup guide](https://aligntrue.ai/docs/08-development/setup) for installation

---

# Dependabot auto-merge strategy

This document explains AlignTrue's hybrid approach to automatically merging Dependabot PRs.

## Overview

**Goal:** Save maintainer time on routine dependency updates while preserving manual review for higher-risk changes.

**Strategy:**

- ✅ Auto-merge: devDependencies, patch & minor updates
- 🚫 Manual review: production dependencies, major version bumps

## Configuration

### 1. `.github/dependabot.yml`

Dependabot is configured to:

- Create separate PRs per directory (workspace isolation)
- Label PRs by scope (devDependencies, schema, cli, web, docs, etc.)
- Group updates intelligently (production vs development)
- Ignore unsafe updates (e.g., Next.js major versions)

**Key scopes:**

- **Root `/`**: dev-dependencies only → auto-merge safe
- **Packages** (`/packages/schema`, `/packages/cli`, etc.): patch/minor only → auto-merge safe
- **Web app** (`/apps/web`): split into dev (auto-merge) + production (manual review)
- **Docs app** (`/apps/docs`): split into dev (auto-merge) + production (manual review)

### 2. `.github/workflows/dependabot-auto-merge.yml`

GitHub Actions workflow that:

1. Detects all Dependabot PRs
2. Checks if PR is labeled as "safe" (devDependencies OR patch/minor without "requires-review")
3. Auto-approves safe PRs with rationale
4. Waits for CI to pass (max 10 minutes)
5. Enables GitHub's auto-merge (squash strategy)
6. Leaves unsafe PRs pending for manual review

**Trigger:** Runs on all pull requests to `main`

**Conditions:**

- Only acts on PRs from `dependabot[bot]`
- Requires passing CI checks before merge
- Uses squash merge to keep commit history clean

## What gets auto-merged

✅ **Automatically merged once CI passes:**

- All devDependencies (test frameworks, linters, build tools)
- Patch updates to production packages (bug fixes)
- Minor updates to production packages (new backward-compatible features)
- **Security patches** (CVE fixes, even if major version) — _high urgency, low risk_

❌ **Requires manual review:**

- Major version bumps (Next.js 15→16, etc.) — unless they're security patches
- Production dependencies not explicitly allowed
- Any PR labeled "requires-review" — except security patches

## What to watch for

1. **CI failures:** If a Dependabot PR fails CI, auto-merge is blocked. Review the error and decide:
   - Is it a real incompatibility? → Manual fix or manual rejection
   - Is it a flaky test? → Re-run CI or merge manually

2. **Security patches:** Now auto-merged at all severity levels (low, medium, high, critical). The approval comment will clearly identify them:
   - Look for `🔒 Auto-approved: Security patch` in the PR comment
   - Verify CI tests pass (they're gated behind full CI run)
   - Merged via squash merge for clean history

3. **Monorepo issues:** Web and docs apps have both auto-merge and manual-review rules to balance safety with developer experience.

## Performance impact

- **Devs:** Zero overhead. PRs auto-merge while you work on other things.
- **CI:** One full test run per Dependabot PR. Runs on Linux + Windows per `.github/workflows/ci.yml`.
- **Review time:** ~0 seconds for safe updates, on-demand for risky ones.

## Disabling auto-merge

To temporarily disable auto-merge or change the strategy:

1. **Disable entirely:** Comment out the `dependabot-auto-merge.yml` workflow
2. **Change scopes:** Edit `.github/dependabot.yml` labels and allow/ignore rules
3. **Change merge method:** Update `dependabot-auto-merge.yml` to use `merge` or `rebase` instead of `squash`

## Testing the setup

### Automatic testing

After pushing these files, the workflow starts on next pull request:

1. Wait for a new Dependabot PR to arrive (weekly on Mondays)
2. Check the PR for:
   - Expected labels (e.g., "devDependencies", "cli", "requires-review", "security")
   - Auto-approval comment from the workflow with reasoning
   - Auto-merge badge once CI passes
3. Monitor GitHub Actions to see the workflow logs

### Testing security patch behavior

To verify security patch auto-merge works:

1. **Check a recent security alert:** Visit https://github.com/AlignTrue/aligntrue/security/dependabot
2. **Wait for next Dependabot run** (Mondays, or trigger manually with `gh workflow run`)
3. **Look for security-specific comment:** If Dependabot creates a PR with "security" label or "Dependabot security update" in body, the workflow will:
   - Show `🔒 Auto-approved: Security patch` comment
   - Run full CI (Linux + Windows)
   - Auto-merge once CI passes
4. **Validate in GitHub Actions:** Check `.github/workflows/dependabot-auto-merge.yml` logs to see security detection logic

## Related documentation

- [GitHub Dependabot docs](https://docs.github.com/en/code-security/dependabot)
- [GitHub auto-merge API](https://docs.github.com/en/rest/pulls/merges?apiVersion=2022-11-28#enable-auto-merge-for-a-pull-request)
- [CI failure prevention](https://aligntrue.ai/docs/08-development/ci-failures)

---

# Package exports

This document lists all public exports from AlignTrue packages. All exports must be documented here before being added to `package.json`.

## Purpose

- Ensures all exports are intentional and documented
- Prevents accidental exposure of internal APIs
- Provides clear guidance for package consumers
- Enables CI validation of exports

## @aligntrue/exporters

| Export Path              | Purpose                                   | Example                                                                                     |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.`                      | Main entry point with exporter registry   | `import { ExporterRegistry } from '@aligntrue/exporters'`                                   |
| `./cursor`               | Cursor exporter plugin                    | `import { CursorExporter } from '@aligntrue/exporters/cursor'`                              |
| `./agents`               | AGENTS.md exporter plugin                 | `import { AgentsMdExporter } from '@aligntrue/exporters/agents'`                            |
| `./vscode-mcp`           | VS Code MCP exporter plugin               | `import { VsCodeMcpExporter } from '@aligntrue/exporters/vscode-mcp'`                       |
| `./utils/section-parser` | Section parsing utilities for agent files | `import { parseAgentsMd, parseCursorMdc } from '@aligntrue/exporters/utils/section-parser'` |

## @aligntrue/core

| Export Path                  | Purpose                                  | Example                                                                           |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `.`                          | Main entry point with core functionality | `import { loadConfig, SyncEngine } from '@aligntrue/core'`                        |
| `./telemetry/collector.js`   | Telemetry collection utilities           | `import { recordEvent } from '@aligntrue/core/telemetry/collector.js'`            |
| `./team/allow.js`            | Team mode allow list management          | `import { parseAllowList } from '@aligntrue/core/team/allow.js'`                  |
| `./team/drift.js`            | Drift detection for team mode            | `import { detectDriftForConfig } from '@aligntrue/core/team/drift.js'`            |
| `./lockfile`                 | Lockfile generation and validation       | `import { generateLockfile, validateLockfile } from '@aligntrue/core/lockfile'`   |
| `./parsing/natural-markdown` | Natural markdown parsing                 | `import { parseNaturalMarkdown } from '@aligntrue/core/parsing/natural-markdown'` |

## @aligntrue/schema

| Export Path | Purpose                     | Example                                                            |
| ----------- | --------------------------- | ------------------------------------------------------------------ |
| `.`         | Schema types and validation | `import type { AlignPack, AlignSection } from '@aligntrue/schema'` |

## @aligntrue/plugin-contracts

| Export Path | Purpose                    | Example                                                             |
| ----------- | -------------------------- | ------------------------------------------------------------------- |
| `.`         | Plugin interface contracts | `import type { ExporterPlugin } from '@aligntrue/plugin-contracts'` |

## @aligntrue/file-utils

| Export Path | Purpose                  | Example                                                    |
| ----------- | ------------------------ | ---------------------------------------------------------- |
| `.`         | File operation utilities | `import { AtomicFileWriter } from '@aligntrue/file-utils'` |

## @aligntrue/sources

| Export Path | Purpose                        | Example                                                  |
| ----------- | ------------------------------ | -------------------------------------------------------- |
| `.`         | Source resolution and fetching | `import { GitSourceProvider } from '@aligntrue/sources'` |

## @aligntrue/cli

| Export Path | Purpose                                  | Example                            |
| ----------- | ---------------------------------------- | ---------------------------------- |
| `.`         | CLI entry point (not typically imported) | N/A - used via `aligntrue` command |

## @aligntrue/testkit

| Export Path | Purpose                        | Example                                               |
| ----------- | ------------------------------ | ----------------------------------------------------- |
| `.`         | Testing utilities and fixtures | `import { createTestPack } from '@aligntrue/testkit'` |

## @aligntrue/ui

| Export Path | Purpose                     | Example                                         |
| ----------- | --------------------------- | ----------------------------------------------- |
| `.`         | UI components for docs site | `import { AlignTrueLogo } from '@aligntrue/ui'` |

## Adding new exports

When adding a new export:

1. **Document it here first** - Add entry to the appropriate package table
2. **Add to package.json** - Update the `exports` field in the package's `package.json`
3. **Build and test** - Verify the export works: `pnpm build && pnpm test`
4. **Update CHANGELOG** - Add entry describing the new export

### Export format

```json
{
  "exports": {
    "./your-export": {
      "types": "./dist/your-export.d.ts",
      "default": "./dist/your-export.js"
    }
  }
}
```

### Validation

CI will validate that:

- All exports in `package.json` are documented here
- All documented exports exist in `package.json`
- All export files exist in the `dist/` directory after build

## Internal vs Public Exports

**Public exports** (documented here):

- Stable APIs for external consumption
- Semantic versioning applies
- Breaking changes require major version bump

**Internal imports** (not exported):

- Use direct file imports within the monorepo
- Example: `import { foo } from '../internal/foo.js'`
- Not subject to semver guarantees
- Can change between minor versions

## Notes

- All export paths use `.js` extensions (not `.ts`) to reference compiled output
- Type definitions (`.d.ts`) are automatically generated during build
- Exports must use ES modules format (`type: "module"` in package.json)

---

# Release process

AlignTrue uses [Changesets](https://github.com/changesets/changesets) for version management and automated npm publishing.

## TL;DR

1. Make changes, push to main
2. Run `pnpm changeset` to document changes
3. Changesets bot creates "Version Packages" PR automatically
4. Merge that PR → packages publish to npm automatically

---

## Day-to-day workflow

### 1. Making changes

Work normally:

```bash
# Make your changes
git add .
git commit -m "feat: add new feature"
git push origin main
```

### 2. Creating a changeset

For each feature/fix that should be in the changelog:

```bash
pnpm changeset
```

This prompts you for:

- **Which packages changed?** (select with space, usually all `@aligntrue/*`)
- **Bump type?** Choose:
  - `patch` - Bug fixes (0.1.0-alpha.2 → 0.1.0-alpha.3)
  - `minor` - New features (0.1.0 → 0.2.0)
  - `major` - Breaking changes (0.1.0 → 1.0.0)
- **Summary** - Brief description for CHANGELOG

This creates a file in `.changeset/` that you commit:

```bash
git add .changeset/
git commit -m "chore: add changeset"
git push
```

### 3. Automatic "Version Packages" PR

The Changesets GitHub Action automatically:

- Creates/updates a PR titled "Version Packages"
- Bumps versions in all `package.json` files
- Updates `CHANGELOG.md`
- Keeps this PR up-to-date as you add more changesets

### 4. Release

When ready to publish:

1. **Review the "Version Packages" PR**
   - Check version bumps are correct
   - Review CHANGELOG entries
   - Verify all packages build

2. **Merge the PR**
   - GitHub Actions automatically publishes to npm
   - Creates a GitHub release
   - Tags the commit

---

## Alpha releases

For pre-1.0 alpha releases:

```bash
# Enter pre-release mode (one time)
pnpm changeset pre enter alpha

# Create changesets as normal
pnpm changeset

# Exit pre-release mode when ready for stable
pnpm changeset pre exit
```

**Current status:** We're in alpha mode, so versions are `0.1.0-alpha.X`.

---

## Manual release (emergency only)

If you need to publish manually:

```bash
# Bump versions
pnpm changeset version

# Build and publish
pnpm release
```

**Note:** This bypasses CI checks. Only use for emergencies.

---

## Setup (one-time)

### 1. Add NPM_TOKEN to GitHub Secrets

1. Generate npm token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Type: **Automation**
   - Scope: **Read and write**
2. Add to GitHub: Settings → Secrets → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: `npm_xxxxxxxxxxxx`

### 2. Verify Changesets config

Already configured in `.changeset/config.json`:

```json
{
  "linked": [["@aligntrue/*"]], // All packages version together
  "access": "public", // Public npm packages
  "baseBranch": "main"
}
```

---

## Troubleshooting

### "Version Packages" PR not created

- Check GitHub Actions tab for errors
- Verify `NPM_TOKEN` secret is set
- Ensure you've created at least one changeset

### Publish failed

- Check npm token hasn't expired
- Verify package names are available on npm
- Check CI logs in GitHub Actions

### Wrong version bump

Before merging "Version Packages" PR:

1. Delete the changeset file that caused it: `.changeset/some-name.md`
2. Create a new changeset with correct bump type
3. PR will auto-update

---

## Related

- [Changesets documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)

---

# Development setup

## Prerequisites

- **Node.js** 22 or later (`.node-version` file included for Volta/asdf/nvm)
- **pnpm** 9 or later

**Install pnpm:**

<Tabs items={["npm", "yarn", "Homebrew (macOS)", "Direct"]}>

<Tabs.Tab>`bash npm install -g pnpm@9 `</Tabs.Tab>

<Tabs.Tab>`bash yarn global add pnpm@9 `</Tabs.Tab>

<Tabs.Tab>
`bash brew install pnpm pnpm env use --global 9 # Set version to 9+ `
</Tabs.Tab>

<Tabs.Tab>
Visit [pnpm.io](https://pnpm.io/installation) for platform-specific
installers.
</Tabs.Tab>

</Tabs>

## Quick start

Bootstrap the entire project with one command:

```bash
pnpm bootstrap
```

This installs dependencies and builds all packages. You're ready to develop!

**Note:** First-time setup takes ~2-3 minutes depending on your machine.

## Install CLI from GitHub

Need to test the latest CLI changes straight from `main`? Because `@aligntrue/cli` imports other workspace packages, build the entire repo before running the binary:

```bash
git clone https://github.com/AlignTrue/aligntrue.git
cd aligntrue
pnpm install          # install all workspace dependencies
pnpm build            # compile every package (core/schema/exporters/cli)
cd packages/cli
pnpm link --global    # exposes the aligntrue/aln commands locally
aligntrue --version
```

Re-run `pnpm build` after dependency changes, or `pnpm --filter @aligntrue/cli build` after CLI-only edits to refresh `dist/`.

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

This will install dependencies for all workspace packages and set up Git hooks automatically.

### 2. Verify installation

After installation completes, verify everything works:

```bash
pnpm typecheck   # Type-check all packages
pnpm test:fast   # Run tests with fast reporter
```

If all checks pass, you're ready to develop!

## Git hooks

Hooks are installed automatically when you run `pnpm install`.

### Pre-commit hook

Runs automatically before each commit:

1. **Format staged files** (~1-2s) - Prettier auto-formats code
2. **Build packages** (~1-3s) - Only if `packages/*/src/**` files changed
3. **Typecheck** (~2-3s) - Type checks all staged TypeScript files

**Total time:**

- Without package changes: ~3-5 seconds
- With package changes: ~4-8 seconds

### Commit message hook

Validates commit messages follow Conventional Commits format:

```bash
# Good commit messages
feat: Add drift detection command
fix: Resolve lockfile sync issue
docs: Update setup guide

# Bad commit messages (will be rejected)
updated stuff
WIP
fixes bug
```

Format: `type: Subject in sentence case`

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`

### Pre-push hook

Runs automatically before pushing (takes ~30-60 seconds):

- Full typecheck across all packages
- Full test suite (all packages)
- Full build to catch build errors
- Mirrors CI validation

This ensures you never push code that will fail CI.

### Bypassing hooks (emergency only)

If hooks are genuinely broken (not just failing validation):

```bash
git commit --no-verify   # Skip pre-commit
git push --no-verify     # Skip pre-push
```

**Only use when hooks are broken, not to skip validation.**

### Hooks not running

If Git hooks aren't running after `pnpm install`:

```bash
pnpm prepare
```

This manually runs the Husky setup.

## Troubleshooting

### "Command not found: pnpm"

**Cause:** pnpm is not installed globally.

**Fix:** See Prerequisites section above for installation instructions.

Verify installation:

```bash
pnpm --version
```

### "Module not found" errors

Reinstall dependencies:

```bash
pnpm clean
pnpm install
```

### Type errors after changes

Run type-check to see all errors:

```bash
pnpm typecheck
```

### Next.js dev server fails with "Cannot find module" errors

**Symptom:** Dev server crashes with errors like:

```
Error: Cannot find module './vendor-chunks/nextra@4.6.0...'
Cannot find module '@aligntrue/ui'
```

**Cause:** Next.js doesn't transpile workspace packages by default. The `@aligntrue/ui` package exports TypeScript source directly (no build step), so Next.js needs to be configured to transpile it.

**Fix:**

1. Check your Next.js config has `transpilePackages`:

```typescript
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ["@aligntrue/ui"],
  // ... rest of config
};
```

```javascript
// apps/docs/next.config.mjs
export default withNextra({
  transpilePackages: ["@aligntrue/ui"],
  // ... rest of config
});
```

2. Clean stale build caches:

```bash
rm -rf apps/web/.next apps/docs/.next
```

3. Restart dev servers:

```bash
pnpm dev:web   # or pnpm dev:docs
```

**Prevention:**

- CI validates `transpilePackages` config: `pnpm validate:transpile-packages`
- Pre-commit hook automatically cleans `.next` directories before each commit
- If you add a new workspace package that exports TypeScript source, add it to `transpilePackages` in both Next.js configs

**Workflow after editing docs:**

```bash
# 1. Edit source files in apps/docs/content/
pnpm dev:docs  # View changes at localhost:3001

# 2. When done, generate root files
pnpm generate:repo-files

# 3. Commit (pre-commit hook handles cache cleanup)
git add -A
git commit -m "docs: Update documentation"
```

**Important:** Never manually edit `README.md`, `DEVELOPMENT.md`, or `CONTRIBUTING.md` - they're auto-generated from docs sources.

### Missing DOM types in UI packages

**Symptom:** TypeScript errors like `Cannot find name 'window'`, `Cannot find name 'document'`

**Cause:** UI packages with React need DOM library types in `tsconfig.json`.

**Fix:**

Add to `tsconfig.json` compilerOptions:

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

**Prevention:** CI validates UI packages with `pnpm validate:ui-tsconfig`.

### Missing type exports

**Symptom:** `Property 'X' does not exist on type 'Y'` in apps consuming schema types.

**Cause:** Type defined in schema package but not exported in `packages/schema/src/index.ts`.

**Fix:**

1. Check the type exists in source file (e.g., `packages/schema/src/catalog-entry.ts`)
2. Add export to `packages/schema/src/index.ts`:

```typescript
export {
  // ... existing exports
  type YourMissingType,
} from "./catalog-entry.js";
```

3. Rebuild schema package:

```bash
pnpm --filter @aligntrue/schema build
```

**Prevention:** CI runs full typecheck across all packages to catch missing exports.

## Next steps

- Learn about the [workspace structure](https://aligntrue.ai/docs/08-development/workspace)
- Explore [development commands](https://aligntrue.ai/docs/08-development/commands)
- Understand [architectural concepts](https://aligntrue.ai/docs/08-development/architecture)

---

# Test maintenance: Core format and path changes

**When to apply**: After commits that change core file formats, paths, or schemas (e.g., YAML vs markdown, `.rules.yaml` vs `rules.md`).

## Problem

Core format changes break many tests at once. The pre-push hook catches this before push, but requires systematic updates.

## Real example

**Commit:** `3315bd09cd2335acdb4ee1dca3cdbf8557570a5e` (2025-11-06)  
**Change:** Switched from markdown-first to agent-format-first architecture

**Result:** 4 test failures

- `packages/cli/tests/commands/import.test.ts`
- `packages/cli/tests/integration/init-command.test.ts` (2 tests)
- `packages/cli/tests/integration/performance.test.ts`

**Root cause:** Tests expected outdated file paths or formats that have been replaced in the current implementation.

**Time to fix:** ~10 minutes with systematic search and replace.

## Solution: Search → update → verify

### Step 1: Identify affected tests

```bash
# Find all references to old format/path
grep -r "old-file-name\|old-extension" packages/*/tests/

# Example: searching for specific file references
grep -r "\.rules\.yaml" packages/*/tests/
```

### Step 2: Update each test file

For each file found, make these changes:

1. **Update file paths**: Use current expected paths
2. **Update expectations**: Match current format/schema
3. **Update config sources**: If config points to old path, update it
4. **Update content checks**: Match current output format

### Pattern example: File format migration

```typescript
// Before
const rulesPath = join(testDir, ".aligntrue", "old-format.md");
const content = readFileSync(rulesPath, "utf-8");
expect(content).toContain("legacy-marker");

// After
const rulesPath = join(testDir, ".aligntrue", ".rules.yaml");
const content = readFileSync(rulesPath, "utf-8");
expect(content).toContain("spec_version:");
expect(content).toContain("id: test-rule");
```

### Step 3: Run tests to verify

```bash
# Test single package
pnpm --filter @aligntrue/cli test

# Test all packages
pnpm test

# Pre-push will run this anyway, but verify locally first
```

## Prevention: Atomic commits

**When making core format changes**, include test updates in the same commit:

```bash
# Good commit message
feat: Switch from YAML-first to agent-format-first
  - Update init command to create .cursor/*.mdc first
  - Update core IR loader to accept only .yaml/.yml
  - Update 3 test files to expect new format

# Bad: leaving test updates for later
feat: Switch to agent-format-first
  (Note: tests failing, will fix separately)
```

## Why this matters

The pre-push hook catches these failures before they hit `main`, but:

- Catching them early saves CI runs
- Fixing them immediately prevents context-switching
- Atomic commits make git history cleaner
- Reviewers see the full picture in one commit

## Related documentation

- [Development setup](https://aligntrue.ai/docs/08-development/setup)

---

# Workspace structure

AlignTrue is a pnpm monorepo with apps and packages organized for clarity and maintainability.

**See [Architecture](https://aligntrue.ai/docs/08-development/architecture#workspace-organization) for the full workspace tree and design principles.**

## Apps

### apps/docs

Nextra-based documentation site (this site).

**Development:**

```bash
cd apps/docs
pnpm dev           # Start dev server at http://localhost:3001
pnpm build         # Production build
```

## Core packages

### packages/schema

Core validation and canonicalization logic.

**Responsibilities:**

- JSON Schema validation
- YAML → canonical JSON (JCS)
- SHA-256 integrity hashing
- IR (Intermediate Representation) types

**Development:**

```bash
cd packages/schema
pnpm test:watch    # Run tests in watch mode
pnpm build         # Build to dist/
```

### packages/core

Config management and sync engine.

**Responsibilities:**

- Parse and validate `.aligntrue.yaml` config
- Two-way sync engine (IR ↔ agents)
- Bundle resolution (team mode)
- Lockfile management (team mode)
- Hierarchical scope resolution

**Development:**

```bash
cd packages/core
pnpm test:watch    # Run tests in watch mode
pnpm build         # Build to dist/
```

### packages/cli

The `aligntrue`/`aln` CLI tool.

**Responsibilities:**

- Command-line interface (init, sync, check, lock, etc.)
- Agent auto-detection
- Interactive prompts
- Git integration

**Development:**

```bash
cd packages/cli
pnpm build
node dist/index.js --help
```

### packages/exporters

Agent-specific export adapters (43 exporters for 28+ agents).

**Responsibilities:**

- Export IR to agent-specific formats
- Cursor `.mdc` files
- `AGENTS.md` universal format
- MCP configurations
- Fidelity notes and metadata

**Development:**

```bash
cd packages/exporters
pnpm test          # Run exporter tests
pnpm build         # Build to dist/
```

## Supporting packages

### Natural markdown parsing

Natural markdown sections → IR conversion (integrated into core).

**Responsibilities:**

- Parse natural markdown with YAML frontmatter
- Convert `##` sections to IR rules
- Validate extracted content

### packages/sources

Multi-source pulling (local, catalog, git, url).

**Responsibilities:**

- Load rules from multiple sources
- Cache management
- Git repository cloning
- HTTP fetching with ETag support

### packages/file-utils

Shared infrastructure utilities.

**Responsibilities:**

- Atomic file writes
- Checksums and integrity verification
- No workspace dependencies (pure utilities)

### packages/plugin-contracts

Plugin interface definitions.

**Responsibilities:**

- ExporterPlugin interface
- AdapterManifest types
- No implementations (just contracts)

### packages/testkit

Conformance vectors and golden tests.

**Responsibilities:**

- Test fixtures
- Golden test data
- Validation test cases

### packages/ui

Shared design system for web properties.

**Responsibilities:**

- AlignTrueLogo component
- Primer-based color tokens
- Nextra theme integration

**Development:**

```bash
cd packages/ui
pnpm test          # Run tests
pnpm test:watch    # Watch mode
pnpm typecheck     # Type checking
```

## Catalog

Local catalog with 11 curated packs:

- **Base Packs** (8): global, docs, typescript, testing, tdd, debugging, security, rule-authoring
- **Stack Packs** (3): nextjs-app-router, vercel-deployments, web-quality

**Structure:**

```
catalog/
├── examples/          # YAML pack definitions
├── packs.yaml         # Registry metadata
└── namespaces.yaml    # Namespace ownership
```

## Package dependencies

Packages are organized in layers:

```
schema (base layer)
  ↓
core, file-utils
  ↓
sources, exporters
  ↓
cli (top layer)
```

Apps depend on multiple packages as needed.

## Working across packages

See [development commands](https://aligntrue.ai/docs/08-development/commands) for package build workflows and watch mode.

## Next steps

- Learn [development commands](https://aligntrue.ai/docs/08-development/commands)
- Understand [architecture concepts](https://aligntrue.ai/docs/08-development/architecture)

---

---

_This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`._
