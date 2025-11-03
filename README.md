# AlignTrue

Instantly sync rules across agents, people, projects and teams. Start in 60 seconds.

Write rules once in markdown. Sync everywhere. Stay aligned.

- **Solo developers:** Keep your personal AI rules consistent across projects and machines.
- **Teams:** Shared rule sets with version control, CI validation, and drift detection.

[![npm version](https://img.shields.io/npm/v/@aligntrue/cli.svg)](https://www.npmjs.com/package/@aligntrue/cli)
[![Tests](https://img.shields.io/badge/tests-1842%20passing-brightgreen)](https://github.com/AlignTrue/aligntrue)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why AlignTrue

- **Write once, sync everywhere** - One markdown file generates agent-specific formats for 28+ AI coding tools
- **60-second setup** - Auto-detects your agents and creates starter rules in under a minute
- **Two-way sync** - Edit rules OR agent files; changes flow both directions automatically

## Quickstart

```bash
npx @aligntrue/cli init  # Auto-detect agents, create .aligntrue/rules.md
# Edit .aligntrue/rules.md (optional)
aligntrue sync           # Generate all agent files
```

**Result:** `.cursor/rules/aligntrue.mdc`, `AGENTS.md`, `.vscode/mcp.json`, and more - all from one source.

## Features

- ✨ **Auto-detection** - Finds Cursor, Copilot, Claude, VS Code, and 25+ other agents automatically
- 🔄 **Two-way sync** - Edit markdown or agent files; AlignTrue keeps them aligned
- 📦 **28+ agents supported** - Comprehensive coverage through 43 specialized exporters
- 🎯 **Agent-optimized formats** - Native .mdc for Cursor, AGENTS.md for universals, MCP configs, and more
- 🔒 **Local-first** - No cloud required; works offline and in CI
- ⚙️ **Team mode** - Optional lockfiles, bundles, and drift detection for teams

## Broad agent support

AlignTrue supports **28+ AI coding agents** through **43 specialized exporters**:

**Popular agents:**

- Cursor (.mdc files)
- GitHub Copilot (AGENTS.md)
- Claude (AGENTS.md + CLAUDE.md)
- Aider (AGENTS.md + .aider.conf.yml)
- Windsurf (AGENTS.md + MCP config)
- VS Code MCP agents
- Amazon Q, Firebase Studio, OpenHands, Zed, and 20+ more

<details>
<summary><strong>View full agent compatibility table (28+ agents, 43 exporters)</strong></summary>

### Exporter categories

**1. MCP (Model Context Protocol) config exporters**

These generate JSON configuration files for agents that support the MCP protocol. MCP allows agents to connect to external tools and data sources. AlignTrue creates `.mcp.json` or equivalent files with rule-based guidance.

**2. Agent-specific format exporters**

These create native configuration files or markdown formats specific to each agent (`.mdc`, `.md`, `.json`, `.yml`, etc.). Each format preserves agent-specific metadata and adapts rules to the agent's preferred structure.

**3. Universal format exporters**

AGENTS.md provides a single, universal markdown format that multiple agents can consume, reducing duplication while maintaining broad compatibility.

**4. Dual-output agents**

Some agents (like Aider) use both a universal format (AGENTS.md) AND their own specific config file for optimal results.

### Key features

- **Fidelity Notes**: Each exporter documents what information may be lost when converting from AlignTrue's IR format
- **Vendor Metadata**: Agent-specific extensions are preserved in `vendor.*` namespaces
- **Version Control**: All exporters are versioned and follow semantic versioning
- **Comprehensive Coverage**: Supports 28+ agents including Cursor, Claude, GitHub Copilot, Aider, and many others

---

| Agent Name          | Exporter Name    | Category         | Output Files                     | Description                                          | Fidelity Notes                              |
| ------------------- | ---------------- | ---------------- | -------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| **Cursor**          | cursor           | Agent-Specific   | `.cursor/rules/*.mdc`            | Scope-based .mdc files with YAML frontmatter         | Session metadata in vendor.cursor namespace |
| **AGENTS.md**       | agents-md        | Universal        | `AGENTS.md`                      | Single universal markdown format for multiple agents | Versioned format (v1), severity as emphasis |
| **VS Code MCP**     | vscode-mcp       | MCP Config       | `.vscode/mcp.json`               | MCP configuration for VS Code agents                 | MCP protocol limitations                    |
| **Claude**          | claude-md        | Agent-Specific   | `CLAUDE.md`                      | Claude-specific markdown format                      | Machine-checkable rules not represented     |
| **GitHub Copilot**  | copilot          | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Aider**           | aider-md         | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Complements aider-config                    |
| **Aider**           | aider-config     | Agent-Specific   | `.aider.conf.yml`                | Aider YAML configuration                             | Complements AGENTS.md                       |
| **Windsurf**        | windsurf-md      | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Complements windsurf-mcp                    |
| **Windsurf**        | windsurf-mcp     | MCP Config       | `.windsurf/mcp_config.json`      | Windsurf MCP configuration                           | Extracts vendor.windsurf fields             |
| **Amazon Q**        | amazonq          | Agent-Specific   | `.amazonq/rules/*.md`            | Directory-based markdown files                       | Directory structure preserved               |
| **Amazon Q**        | amazonq-mcp      | MCP Config       | `.amazonq/mcp.json`              | Amazon Q MCP configuration                           | MCP protocol features                       |
| **Firebase Studio** | firebase-studio  | Agent-Specific   | `.idx/airules.md`                | Firebase IDX airules format                          | IDX-specific structure                      |
| **Firebase**        | firebase-mcp     | MCP Config       | `.idx/mcp.json`                  | Firebase IDX MCP config                              | IDX environment integration                 |
| **KiloCode**        | kilocode         | Agent-Specific   | `.kilocode/rules/*.md`           | Directory-based markdown files                       | Directory structure preserved               |
| **KiloCode**        | kilocode-mcp     | MCP Config       | `.kilocode/mcp.json`             | KiloCode MCP configuration                           | MCP protocol features                       |
| **OpenHands**       | openhands        | Agent-Specific   | `.openhands/microagents/repo.md` | OpenHands microagents format                         | Microagents structure                       |
| **OpenHands**       | openhands-config | Agent-Specific   | `config.toml`                    | OpenHands TOML configuration                         | TOML format limitations                     |
| **Roo Code**        | roocode-md       | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Roo Code**        | roocode-mcp      | MCP Config       | `.roo/mcp.json`                  | Roo Code MCP configuration                           | MCP protocol features                       |
| **Cursor MCP**      | cursor-mcp       | MCP Config       | `.cursor/mcp.json`               | Cursor MCP configuration                             | Cursor-specific MCP setup                   |
| **Root MCP**        | root-mcp         | MCP Config       | `.mcp.json`                      | Generic MCP config (Claude Code, Aider)              | Root-level MCP config                       |
| **Zed**             | zed-md           | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Complements zed-config                      |
| **Zed**             | zed-config       | Agent-Specific   | `.zed/settings.json`             | Zed JSON configuration                               | JSON format limitations                     |
| **Gemini CLI**      | gemini-cli       | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Gemini**          | gemini-config    | Agent-Specific   | `.gemini/settings.json`          | Gemini JSON configuration                            | JSON format limitations                     |
| **Qwen Code**       | qwen-code        | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Qwen**            | qwen-config      | Agent-Specific   | `.qwen/settings.json`            | Qwen JSON configuration                              | JSON format limitations                     |
| **OpenAI Codex**    | openai-codex     | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Open Code**       | opencode-md      | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Open Code**       | opencode-config  | Agent-Specific   | `opencode.json`                  | Open Code JSON configuration                         | JSON format limitations                     |
| **CrushChat**       | crush-md         | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Complements crush-config                    |
| **CrushChat**       | crush-config     | Agent-Specific   | `.crush.json`                    | CrushChat JSON configuration                         | JSON format limitations                     |
| **Warp**            | warp-md          | Agent-Specific   | `WARP.md`                        | Warp-specific markdown format                        | Warp format limitations                     |
| **Cline**           | cline            | Agent-Specific   | `.clinerules`                    | Cline plain text format                              | Plain text limitations                      |
| **Goose**           | goose            | Agent-Specific   | `.goosehints`                    | Goose plain text format                              | Plain text limitations                      |
| **Firebender**      | firebender       | Agent-Specific   | `firebender.json`                | Firebender JSON configuration                        | JSON format limitations                     |
| **Trae AI**         | trae-ai          | Agent-Specific   | `.trae/rules/project_rules.md`   | Trae AI project rules format                         | Project-specific structure                  |
| **Junie**           | junie            | Agent-Specific   | `.junie/guidelines.md`           | Junie guidelines format                              | Guidelines structure                        |
| **Augment Code**    | augmentcode      | Agent-Specific   | `.augment/rules/*.md`            | Directory-based markdown files                       | Directory structure preserved               |
| **Kiro**            | kiro             | Agent-Specific   | `.kiro/steering/*.md`            | Directory-based steering files                       | Steering structure                          |
| **Jules**           | jules            | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |
| **Amp**             | amp              | Universal Shared | AGENTS.md                        | Uses universal AGENTS.md format                      | Shared with other agents                    |

Built-in extensibility allows the community to [add support for new agents or MCPs](docs/extending-aligntrue.md).

### Coverage statistics

- **43 total exporters** supporting **28+ agents**
- **8 MCP configurations** for protocol-based agents
- **15 unique format exporters** for agent-specific formats
- **11 universal format agents** using AGENTS.md
- **9 dual-output agents** with both universal + specific formats

This comprehensive coverage ensures AlignTrue rules work across the entire AI coding agent ecosystem, from established tools like Cursor and GitHub Copilot to emerging agents like Windsurf and Roo Code.

</details>

## How it works

1. **Write rules** in `.aligntrue/rules.md` using simple markdown
2. **Run sync** - AlignTrue detects installed agents and generates optimized formats
3. **Agent-specific exports** - Each agent gets its native format (.mdc, .json, .yml, etc.)
4. **Stay aligned** - Edit markdown or agent files; sync keeps everything consistent

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

- Edit `.aligntrue/rules.md` → sync to agents (default)
- Edit agent files → auto-pull to rules.md (optional, enabled by default)

See [workflows guide](https://aligntrue.ai/docs/guides/workflows) for details.

**Optional verification:**

```bash
aligntrue sync --dry-run       # Preview changes
aligntrue sync --no-auto-pull  # Disable auto-pull for this sync
aligntrue check                # Validate rules (great for CI)
```

## Who is this for?

**Solo developers:** Keep your personal AI rules consistent across projects and machines

**Teams:** Shared rule sets with version control, CI validation, and drift detection

## Catalog website

The AlignTrue catalog provides discovery and sharing for **11 curated packs** stored locally in `catalog/examples/`:

- **Base Packs** (8): global, docs, typescript, testing, tdd, debugging, security, rule-authoring
- **Stack Packs** (3): nextjs-app-router, vercel-deployments, web-quality

**Features:**

- **Browse** (`/catalog`) - Search, filter by category/tools, sort by popularity
- **Detail** (`/catalog/[slug]`) - Pack info, exporter previews, install commands
- **Homepage** (`/`) - Quickstart guide and featured packs

**Local development:**

```bash
cd apps/web
pnpm dev
# Open http://localhost:3000
```

**Build catalog:**

```bash
node temp-build-catalog.mjs
# Generates apps/web/public/catalog/*.json from catalog/packs.yaml
```

**Current status:** 232/269 tests passing (86%). See [catalog.md](docs/catalog.md) for catalog structure and management.

## Learn more

- [Full documentation](https://aligntrue.ai/docs)
- [Catalog website](https://aligntrue.ai/catalog) - Browse 11 curated rule packs
- [Contributing guide](CONTRIBUTING.md)
- [Development guide](DEVELOPMENT.md)
- [Security policy](SECURITY.md)

## Support

- [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues)
- [Discussions](https://github.com/AlignTrue/aligntrue/discussions)

---

## For contributors

### Workspace structure

This is a pnpm monorepo with the following packages:

```
aligntrue/
├── apps/
│   └── web/          # Catalog Next.js site (ACTIVE - 246/266 tests, 92% pass rate)
├── packages/
│   ├── schema/       # JSON Schema, canonicalization, hashing
│   ├── core/         # Config management, sync engine
│   ├── cli/          # Node CLI (aligntrue/aln)
│   ├── exporters/    # 43 exporters for 28+ AI agents
│   └── [8 more packages]
├── catalog/
│   ├── examples/     # 11 curated packs (local seed data)
│   ├── packs.yaml    # Registry metadata
│   └── namespaces.yaml  # Namespace ownership
└── archive/
    ├── apps-docs/    # Nextra documentation (deferred)
    └── mcp-v1/       # MCP server (deferred)
```

### Development setup

**Prerequisites:**

- Node.js 20+
- pnpm 9+

**Workspace installation:**

```bash
pnpm install
```

**Development:**

```bash
# Start web app dev server
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type check all packages
pnpm typecheck
```

## License

MIT (see [LICENSE](LICENSE) )
