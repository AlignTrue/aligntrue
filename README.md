# AlignTrue

AI-native rules and alignment platform. Turn small, composable YAML rules (Aligns) into deterministic bundles and agent-ready exports.

## 60-second quick start

### 1. Install AlignTrue

```bash
# Add to your project (recommended)
pnpm add -D @aligntrue/cli

# Or use without installing
npx @aligntrue/cli init
```

### 2. Initialize Your Project

```bash
aligntrue init
```

**What this does:**

- Auto-detects AI coding agents (Cursor, Copilot, Claude, etc.)
- Creates `.aligntrue/config.yaml` with detected agents enabled
- Creates `.aligntrue/rules.md` with 5 example rules
- Prompts to run sync immediately

### 3. Edit Rules (Optional)

Edit `.aligntrue/rules.md` to customize the starter rules for your project.

### 4. Sync to All Your Agents

```bash
aligntrue sync
```

**What this generates:**

- `.cursor/rules/aligntrue.mdc` (for Cursor)
- `AGENTS.md` (for Copilot, Claude, Aider, and 10+ others)
- `.vscode/mcp.json` (for VS Code MCP agents)
- Plus any other agent-specific files based on your config

## Complete workflow summary

**First-time setup (2 commands):**

```bash
aligntrue init    # Detect agents + create config/rules
aligntrue sync    # Generate agent files
```

**Ongoing workflow (1 command):**

```bash
aligntrue sync    # Update all agents when rules change
```

**Optional verification:**

```bash
aligntrue sync --dry-run    # Preview changes
aligntrue check             # Validate rules (great for CI)
```

## What you get

After running these commands, you'll have:

- ✅ **Consistent rules** across all your AI coding agents
- ✅ **Agent-optimized formats** (native `.mdc` for Cursor, universal markdown for others)
- ✅ **Automatic detection** of installed agents
- ✅ **No manual configuration** required for most setups

The entire process takes **under 60 seconds** for a typical setup with 2-3 agents!

## Supported agents & MCPs

AlignTrue provides **comprehensive coverage** of 28+ AI coding agents through **43 exporters** that fall into several categories:

### **1. MCP (Model Context Protocol) config exporters**

These generate JSON configuration files for agents that support the MCP protocol. MCP allows agents to connect to external tools and data sources. AlignTrue creates `.mcp.json` or equivalent files with rule-based guidance.

### **2. Agent-specific format exporters**

These create native configuration files or markdown formats specific to each agent (`.mdc`, `.md`, `.json`, `.yml`, etc.). Each format preserves agent-specific metadata and adapts rules to the agent's preferred structure.

### **3. Universal format exporters**

AGENTS.md provides a single, universal markdown format that multiple agents can consume, reducing duplication while maintaining broad compatibility.

### **4. Dual-output agents**

Some agents (like Aider) use both a universal format (AGENTS.md) AND their own specific config file for optimal results.

### **Key Features:**

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

## Usage summary

**For Users:**

1. **Auto-Detection**: `aligntrue init` detects which agents you have installed
2. **Multi-Agent Support**: One AlignTrue config generates rules for all your agents
3. **Universal Fallback**: AGENTS.md works with many agents as a baseline
4. **Agent-Specific Optimization**: Dedicated exporters provide better integration for popular agents

**For Agent Developers:**

- **Manifest-Driven**: Add `manifest.json` + optional handler to contribute new exporters
- **Schema Validation**: All manifests validated against JSON Schema
- **Fidelity Transparency**: Document format limitations in `fidelityNotes`
- **Community Scalable**: No core changes needed to add new agents

**Coverage Statistics:**

- **43 total exporters** supporting **28+ agents**
- **8 MCP configurations** for protocol-based agents
- **15 unique format exporters** for agent-specific formats
- **11 universal format agents** using AGENTS.md
- **9 dual-output agents** with both universal + specific formats

This comprehensive coverage ensures AlignTrue rules work across the entire AI coding agent ecosystem, from established tools like Cursor and GitHub Copilot to emerging agents like Windsurf and Roo Code.

## Workspace structure

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

**Phase Status (2025-10-31):**

- ✅ Phase 1: CLI-first architecture complete (786 tests)
- ✅ Phase 2: Import parsers & git sources complete (1149 tests)
- ✅ Phase 3: Team mode complete (1842 tests)
- ✅ Phase 3.5: Overlays complete (163 overlay tests)
- 🚧 Phase 4: Catalog website active (246 tests, 92% pass rate)
- 📋 Phase 4.5: Pre-launch stabilization (next)
- 🔮 Phase 5: Paid cloud (post-launch, adoption trigger required)

## Development setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Workspace installation

```bash
pnpm install
```

### Development

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

## Repositories

- **AlignTrue/aligntrue** (MIT, this repo): Catalog website, CLI, core packages, 43 exporters
- **AlignTrue/aligns** (CC0): Public rules registry (can be mirrored later)
- **AlignTrue/cloud** (private): Commercial features (Phase 5, post-launch)

## Catalog Website

The AlignTrue catalog provides discovery and sharing for **11 curated packs** stored locally in `catalog/examples/`:

- **Base Packs** (8): global, docs, typescript, testing, tdd, debugging, security, rule-authoring
- **Stack Packs** (3): nextjs-app-router, vercel-deployments, web-quality

**Features:**

- **Browse** (`/catalog`) - Search, filter by category/tools, sort by popularity
- **Detail** (`/catalog/[slug]`) - Pack info, exporter previews, install commands
- **Homepage** (`/`) - Quickstart guide and featured packs

**Local Development:**

```bash
cd apps/web
pnpm dev
# Open http://localhost:3000
```

**Build Catalog:**

```bash
node temp-build-catalog.mjs
# Generates apps/web/public/catalog/*.json from catalog/packs.yaml
```

**Current Status:** 232/269 tests passing (86%). See `docs/catalog.md` for catalog structure and management.

## Documentation

**Project Documentation:**

- [Contributing Guide](CONTRIBUTING.md)
- [Development Guide](DEVELOPMENT.md)
- [Security Policy](SECURITY.md)

Full documentation will be available at aligntrue.com/docs.

## License

MIT (see LICENSE file)
