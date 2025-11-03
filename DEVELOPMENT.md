<!-- AUTO-GENERATED from apps/docs/content - DO NOT EDIT DIRECTLY -->
<!-- Edit the source files in apps/docs/content and run 'pnpm generate:repo-files' -->

# Development guide

This guide is auto-generated from the [AlignTrue documentation site](https://aligntrue.ai/docs/development).

# Development setup

## Prerequisites

- **Node.js** 20 or later (`.node-version` file included for Volta/asdf/nvm)
- **pnpm** 9 or later

Install pnpm if you don't have it:

```bash
npm install -g pnpm@9
```

## Quick start

Bootstrap the entire project with one command:

```bash
pnpm bootstrap
```

This installs dependencies and builds all packages. You're ready to develop!

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

Install pnpm globally:

```bash
npm install -g pnpm@9
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

### Stale Next.js build cache errors

**Symptom:** Module not found errors like `Cannot find module './vendor-chunks/nextra@4.6.0...'`

**Cause:** Next.js `.next` directory contains stale vendor chunks after dependency updates.

**Fix:**

```bash
# Clean all Next.js build caches
rm -rf apps/web/.next apps/docs/.next

# Rebuild
pnpm --filter @aligntrue/web build
pnpm --filter @aligntrue/docs build
```

**Prevention:** The pre-commit hook automatically cleans `.next` directories before validation.

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

- Learn about the [workspace structure](https://aligntrue.ai/docs/development/workspace)
- Explore [development commands](https://aligntrue.ai/docs/development/commands)
- Understand [architectural concepts](https://aligntrue.ai/docs/development/architecture)

---

# Workspace structure

AlignTrue is a pnpm monorepo with apps and packages organized for clarity and maintainability.

## Overview

```
aligntrue/
├── apps/
│   ├── web/          # Next.js catalog site
│   └── docs/         # Nextra documentation
├── packages/
│   ├── schema/       # JSON Schema, canonicalization, hashing
│   ├── core/         # Config, sync engine, bundle/lockfile
│   ├── cli/          # aligntrue/aln CLI
│   ├── exporters/    # Agent-specific exports (Cursor, AGENTS.md, etc.)
│   └── ...           # Other packages
└── catalog/          # Local catalog with curated packs
```

## Apps

### apps/web

The Next.js catalog site providing discovery and sharing for rule packs.

**Key features:**

- Search and browse 11 curated packs
- Pack detail pages with exporter previews
- Install commands and documentation

**Development:**

```bash
cd apps/web
pnpm dev           # Start dev server at http://localhost:3000
pnpm build         # Production build
pnpm test          # Run tests
```

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

### packages/markdown-parser

Literate markdown → IR conversion.

**Responsibilities:**

- Parse fenced ```aligntrue blocks
- Convert markdown to IR
- Validate extracted YAML

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

### packages/checks

Machine-checkable rules engine.

**Responsibilities:**

- Execute check types (file_presence, regex, etc.)
- Generate evidence and autofix hints
- Report findings with severity

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
- ThemeProvider and ThemeToggle
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
core, markdown-parser, file-utils
  ↓
sources, exporters
  ↓
cli (top layer)
```

Apps depend on multiple packages as needed.

## Working across packages

See [development commands](https://aligntrue.ai/docs/development/commands) for package build workflows and watch mode.

## Next steps

- Learn [development commands](https://aligntrue.ai/docs/development/commands)
- Understand [architecture concepts](https://aligntrue.ai/docs/development/architecture)

---

# Development commands

Common commands and workflows for AlignTrue development.

## Core commands

### Run the web app locally

```bash
pnpm dev
```

Opens the Next.js app at `http://localhost:3000` (from `apps/web`)

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
- **ThemeProvider** - System preference detection with manual light/dark toggle
- **ThemeToggle** - Button to switch between themes
- **Primer-based colors** - Semantic tokens that adapt to light/dark modes

### Using the design system

Import components and styles in your Next.js app:

```tsx
import { AlignTrueLogo, ThemeProvider, ThemeScript, ThemeToggle } from "@aligntrue/ui";
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

See [workspace structure](https://aligntrue.ai/docs/development/workspace) for complete documentation.

### Testing themes

Test both light and dark modes during development:

1. Use the theme toggle in the UI
2. Check browser DevTools → Application → Local Storage for `aligntrue-theme`
3. Toggle system preference in OS settings to test "system" mode
4. Verify no FOUC (flash of unstyled content) on page load

### Nextra documentation sites

For Nextra-based docs, use the theme config factory:

```tsx
import { createAlignTrueNextraTheme } from "@aligntrue/ui/nextra";
import "@aligntrue/ui/styles/tokens.css";
import "@aligntrue/ui/nextra/nextra.css";

const themeConfig = createAlignTrueNextraTheme({
  docsRepositoryBase: "https://github.com/org/repo/tree/main/apps/docs",
  logoSize: "md",
});
```

This provides:

- Branded logo in navbar
- Consistent sidebar and TOC configuration
- Primer colors mapped to Nextra theme variables

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

- Review [workspace structure](https://aligntrue.ai/docs/development/workspace)
- Understand [architecture concepts](https://aligntrue.ai/docs/development/architecture)
- See [setup guide](https://aligntrue.ai/docs/development/setup) for installation

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

- `aligntrue.yaml` (IR) is the canonical source, not bundles
- Literate markdown with fenced ```aligntrue blocks compiles to IR
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
- **Catalog publishing** (`aligntrue publish` in Phase 4) - Produce integrity hash for distribution
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
- `packages/markdown-parser/src/parser.ts` – Markdown parsing

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

- Stored in exporter metadata
- Written to export file footers
- Help users understand limitations
- Guide decisions about which exporters to use

### Footer format

All exports include:

- Lock hash (if available)
- Exporter version
- Capabilities version
- Loss count (fidelity notes)

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

## Security considerations

- No outbound network calls in core path
- Telemetry opt-in via env var (off by default)
- Never log secrets or PII
- Never commit real tokens
- Atomic file writes prevent corruption
- Sandbox execution for command runners

## Next steps

- Review [workspace structure](https://aligntrue.ai/docs/development/workspace)
- Explore [development commands](https://aligntrue.ai/docs/development/commands)
- See [setup guide](https://aligntrue.ai/docs/development/setup) for installation

---

**This file is auto-generated from the [AlignTrue documentation site](https://aligntrue.ai/docs).**  
**To propose changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`.**
