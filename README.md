<!--
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY

  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files

  Source: apps/docs/content/index.mdx
-->

# Intro

Instantly sync rules across agents, people, projects and teams. Start in 60 seconds.

Write rules once in markdown. Sync everywhere. Stay aligned.

- **Solo developers:** Keep your personal AI rules consistent across projects and machines.
- **Teams:** Shared rule sets with version control, CI validation, and drift detection.

[![CI](https://img.shields.io/github/actions/workflow/status/AlignTrue/aligntrue/ci.yml?label=CI)](https://github.com/AlignTrue/aligntrue/actions) [![npm version](https://img.shields.io/npm/v/aligntrue.svg)](https://www.npmjs.com/package/aligntrue) [![Node 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/AlignTrue/aligntrue/blob/main/LICENSE)

## Solo developer? Start here

Get AlignTrue running in 60 seconds:

```bash
npm install -g aligntrue
aligntrue init
aligntrue sync
```

Auto-detects agents, imports existing rules, or creates AGENTS.md. Generates and updates each agent's native files (Cursor, AGENTS.md, VS Code, etc.).

**Edit rules in your agent's native format.** AlignTrue works seamlessly with Cursor (`.mdc`), GitHub Copilot, Claude Code, and 28+ agents. No config changes needed.

→ [Verify it works](https://aligntrue.ai/docs/00-getting-started/00-quickstart#verify-it-works) | [Solo guide](https://aligntrue.ai/docs/01-guides/04-solo-developer-guide)

## Why AlignTrue

- **Works with your existing setup** - Auto-detects your agents and lets you edit in native formats
- **60-second setup** - No configuration required for common workflows
- **Two-way sync** - Edit any agent file, changes sync everywhere automatically (solo mode)

## Built for reliability

**Enterprise-grade validation and determinism:**

- **TypeScript 5+ strict mode** - Comprehensive type coverage across the entire codebase
- **JSON Schema 2020-12 validation** - All IR and config validated with Ajv strict mode
- **1800+ deterministic tests** - Vitest + Playwright with reproducible, seed-controlled execution
- **Canonical JSON hashing** - JCS-based reproducible hashing for lockfiles and integrity verification
- **Atomic operations** - Safe file writes prevent corruption across sync operations

Why this matters: AlignTrue validates every operation against schemas and ensures byte-identical outputs for identical inputs. Your AI agent configurations are never corrupted, even during concurrent syncs or network failures.

## Features

- **Auto-detection** - Finds Cursor, Copilot, Claude, VS Code, and 25+ other agents automatically
- **Two-way sync** - Edit markdown or agent files; AlignTrue keeps them aligned
- **28+ agents supported** - Comprehensive coverage through 44 exporters
- **Agent-optimized formats** - Native .mdc for Cursor, AGENTS.md for universals, MCP configs, and more
- **Local-first** - No cloud required; works offline and in CI
- **Team mode** - Optional lockfiles, bundles, and drift detection for teams

## Broad agent support

AlignTrue supports **28+ AI coding agents** through **44 exporters**:

**Popular agents:**

- Cursor (.mdc files)
- GitHub Copilot (AGENTS.md)
- Claude (AGENTS.md + CLAUDE.md)
- Aider (AGENTS.md + .aider.conf.yml)
- Windsurf (AGENTS.md + MCP config)
- VS Code MCP agents
- Amazon Q, Firebase Studio, OpenHands, Zed, and 20+ more

**Coverage:**

- 44 total exporters supporting 28+ agents
- 8 MCP configurations for protocol-based agents
- 15 unique format exporters for agent-specific formats
- 11 universal format agents using AGENTS.md
- 9 dual-output agents with both universal + specific formats

[View full agent compatibility matrix →](https://aligntrue.ai/docs/04-reference/agent-support)

## How it works

1. **AlignTrue detects your agents** - Finds Cursor, Copilot, Claude Code, and 28+ others automatically
2. **Edit in your native format** - Use `.cursor/rules/*.mdc`, `AGENTS.md`, or whatever you already use
3. **Run sync** - AlignTrue updates all agents with your changes
4. **Stay aligned** - Two-way sync keeps everything consistent automatically

## Common workflows

**Solo developer (default):**

```bash
aligntrue init    # One-time setup
aligntrue sync    # Update agents when rules change
```

**Team mode (opt-in):**

```bash
aligntrue lock    # Pin rule versions
aligntrue check   # Validate in CI
```

**Two-way sync:**

- Edit `AGENTS.md` or agent files → sync to other agents (default)
- Auto-pull enabled for `primary_agent` by default

See [workflows guide](https://aligntrue.ai/docs/01-guides/01-workflows) for details.

**Optional verification:**

```bash
aligntrue sync --dry-run       # Preview changes
aligntrue sync --no-auto-pull  # Disable auto-pull for this sync
aligntrue check                # Validate rules (great for CI)
```

## Who is this for?

**Solo developers:** Keep your personal AI rules consistent across projects and machines

**Teams:** Shared rule sets with version control, CI validation, and drift detection

## Key concepts

- [Quickstart](https://aligntrue.ai/docs/00-getting-started/00-quickstart) - Get AlignTrue running in 60 seconds
- [Glossary](https://aligntrue.ai/docs/03-concepts/glossary) - AlignTrue terminology and key concepts explained
- [Customization](https://aligntrue.ai/docs/02-customization) - Plugs, overlays, and scopes for fork-safe customization
- [Team Mode](https://aligntrue.ai/docs/03-concepts/team-mode) - Collaboration features for teams
- [Sync Behavior](https://aligntrue.ai/docs/03-concepts/sync-behavior) - How two-way sync works
- [Drift Detection](https://aligntrue.ai/docs/03-concepts/drift-detection) - Track alignment changes over time
- [Git Workflows](https://aligntrue.ai/docs/03-concepts/git-workflows) - Pull and share rules via git
- [Examples](https://aligntrue.ai/docs/04-reference/examples) - Browse 11 curated rule packs

## Reference

- [CLI Commands](https://aligntrue.ai/docs/04-reference/cli-reference) - Complete command reference
- [Concepts](https://aligntrue.ai/docs/03-concepts/glossary) - Understand AlignTrue terminology
- [Troubleshooting](https://aligntrue.ai/docs/05-troubleshooting) - Common issues and solutions

## Contributing

Want to contribute? Check out the guides:

- [Getting Started](https://aligntrue.ai/docs/06-contributing/getting-started) - Set up your development environment
- [Creating Packs](https://aligntrue.ai/docs/06-contributing/creating-packs) - Author and publish rule packs
- [Adding Exporters](https://aligntrue.ai/docs/06-contributing/adding-exporters) - Add support for new agents

## Development

Setting up AlignTrue for local development:

- [Setup](https://aligntrue.ai/docs/08-development/setup) - Prerequisites and installation
- [Workspace](https://aligntrue.ai/docs/08-development/workspace) - Monorepo structure and packages
- [Commands](https://aligntrue.ai/docs/08-development/commands) - Development commands and scripts
- [Architecture](https://aligntrue.ai/docs/08-development/architecture) - Key architectural concepts

## Learn more

- [GitHub repository](https://github.com/AlignTrue/aligntrue)
- [Examples](https://aligntrue.ai/docs/04-reference/examples) - Browse 11 curated rule packs
- [Security policy](https://github.com/AlignTrue/aligntrue/blob/main/SECURITY.md)

## Support

- [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues)
- [Discussions](https://github.com/AlignTrue/aligntrue/discussions)

## License

MIT (see [LICENSE](https://github.com/AlignTrue/aligntrue/blob/main/LICENSE))

---

_This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`._
