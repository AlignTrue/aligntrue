---
title: Workspace
description: Monorepo structure and packages overview for AlignTrue.
---

# Workspace structure

AlignTrue is a pnpm monorepo with apps and packages organized for clarity and maintainability.

**See [Architecture](/docs/06-development/architecture#workspace-organization) for the full workspace tree and design principles.**

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

- Parse and validate `.aligntrue/config.yaml` configuration
- Sync engine (rules → IR → agents)
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
pnpm test          # CLI unit/integration tests
pnpm build         # Build to dist/
node dist/index.js --help
```

### packages/exporters

Agent-specific exporters for Cursor, `AGENTS.md`, MCP targets, and other agent formats.

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
pnpm test:watch    # Watch mode
pnpm build         # Build to dist/
```

## Supporting packages

### Natural markdown parsing (core parsing layer)

Natural markdown sections → IR conversion (implemented in the core parsing layer).

**Responsibilities:**

- Parse natural markdown with optional YAML frontmatter
- Convert heading sections to IR rules
- Validate extracted content before handing off to core

### packages/sources

Multi-source pulling (local, catalog, git, url).

**Responsibilities:**

- Load rules from multiple sources
- Cache management
- Git repository cloning
- HTTP fetching with ETag support
- Deterministic content hashing for remote sources

### packages/file-utils

Shared infrastructure utilities.

**Responsibilities:**

- Atomic file writes
- Checksums and integrity verification
- No workspace dependencies (pure utilities, safe for cross-package reuse)

### packages/plugin-contracts

Plugin interface definitions.

**Responsibilities:**

- ExporterPlugin interface
- ExporterManifest types
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

### Using the design system

AlignTrue uses a centralized design system (`@aligntrue/ui`) for consistent branding across all web properties.

**Key components:**

- **AlignTrueLogo** - SVG logo with theme-aware colors and orange colon (#F5A623)
- **Primer-based colors** - Semantic tokens that adapt to light/dark modes

**Import components and styles in your Next.js app:**

```tsx
import { AlignTrueLogo } from "@aligntrue/ui";
import "@aligntrue/ui/styles/tokens.css";
```

**Color tokens:**

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

**Testing themes:**

Test both light and dark modes during development:

1. Use the theme toggle in the UI
2. Check browser DevTools → Application → Local Storage for `aligntrue-theme`
3. Toggle system preference in OS settings to test "system" mode
4. Verify no FOUC (flash of unstyled content) on page load

**Nextra documentation sites:**

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

See [development commands](/docs/06-development/commands) for package build workflows and watch mode.

From the repo root you can target a package without changing directories:

```bash
pnpm --filter @aligntrue/core test -- --watch
pnpm --filter @aligntrue/cli build
```

## Next steps

- Learn [development commands](/docs/06-development/commands)
- Understand [architecture concepts](/docs/06-development/architecture)
- Review [CI guide](/docs/06-development/ci) for validation workflows
