---
title: Package Exports
description: Documentation of all package exports in the AlignTrue monorepo
---

# Package Exports

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
| `./agents-md`            | AGENTS.md exporter plugin                 | `import { AgentsMdExporter } from '@aligntrue/exporters/agents-md'`                         |
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

## Adding New Exports

When adding a new export:

1. **Document it here first** - Add entry to the appropriate package table
2. **Add to package.json** - Update the `exports` field in the package's `package.json`
3. **Build and test** - Verify the export works: `pnpm build && pnpm test`
4. **Update CHANGELOG** - Add entry describing the new export

### Export Format

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
