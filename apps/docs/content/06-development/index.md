---
title: "Development guide"
description: "Develop AlignTrue locally: setup, workspace layout, commands, and architecture overview."
---

# Development guide

Resources for contributing to AlignTrue and understanding the codebase.

## Prerequisites

- Node >=20 and pnpm >=9 (see `package.json` engines)
- Install dependencies once at repo root with `pnpm install` before running commands

## Getting started

- [Setup](./setup) - Local development environment setup
- [Workspace](./workspace) - Monorepo structure and package organization
- [Commands](./commands) - Build, test, and development commands
- [Architecture](./architecture) - System design and technical decisions

## Development workflow

1. **Clone and setup**: Follow the [setup guide](./setup)
2. **Make changes**: Edit code in the relevant package
3. **Fast test loop**: Use `pnpm test:fast` during iteration
4. **Lint and types**: Run `pnpm lint` then `pnpm typecheck`
5. **Build**: Run `pnpm build` to verify compilation
6. **CI parity**: See [CI checks](./ci) for full validation before PRs

## Package structure

AlignTrue uses a pnpm workspace with the following packages:

- `packages/cli` - Command-line interface
- `packages/core` - Core sync engine and configuration
- `packages/schema` - IR validation and canonicalization
- `packages/exporters` - Agent-specific exporters (see [agent support](../04-reference/agent-support) for the current list)
- `packages/sources` - Multi-source pulling (local, git)
- `apps/docs` - Documentation site (Nextra)

See [workspace guide](./workspace) for detailed package descriptions.
