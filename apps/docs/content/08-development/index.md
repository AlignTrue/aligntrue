---
title: "Development guide"
description: "Develop AlignTrue locally: setup, workspace layout, commands, and architecture overview."
---

# Development guide

Resources for contributing to AlignTrue and understanding the codebase.

## Getting started

- [Setup](./setup) - Local development environment setup
- [Workspace](./workspace) - Monorepo structure and package organization
- [Commands](./commands) - Build, test, and development commands
- [Architecture](./architecture) - System design and technical decisions

## Quick links

### Contributing

- [Getting started guide](../06-contributing/getting-started) - How to contribute
- [Testing workflow](../06-contributing/testing-workflow) - Running and writing tests
- [Adding exporters](../06-contributing/adding-exporters) - Creating new agent adapters

### Documentation

- [Editing docs](../06-contributing/editing-docs) - How to update documentation
- [Creating packs](../06-contributing/creating-packs) - Publishing rule packs

## Development workflow

1. **Clone and setup**: Follow the [setup guide](./setup)
2. **Make changes**: Edit code in relevant package
3. **Test locally**: Run tests with `pnpm test`
4. **Build**: Run `pnpm build` to verify compilation
5. **Submit PR**: Follow [contributing guidelines](../06-contributing/getting-started)

## Package structure

AlignTrue uses a pnpm workspace with the following packages:

- `packages/cli` - Command-line interface
- `packages/core` - Core sync engine and configuration
- `packages/schema` - IR validation and canonicalization
- `packages/exporters` - Agent-specific exporters (43 adapters)
- `packages/sources` - Multi-source pulling (local, git)
- `apps/docs` - Documentation site (Nextra)

See [workspace guide](./workspace) for detailed package descriptions.
