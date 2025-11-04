---
title: Workspace Structure
description: Monorepo structure and packages overview for AlignTrue.
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

See [development commands](/docs/07-development/commands) for package build workflows and watch mode.

## Next steps

- Learn [development commands](/docs/07-development/commands)
- Understand [architecture concepts](/docs/07-development/architecture)
