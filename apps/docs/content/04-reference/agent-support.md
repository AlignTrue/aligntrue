---
title: Agent support
description: Complete compatibility matrix for AlignTrue's 43 exporters supporting 28+ AI coding agents
---

# Agent Support

AlignTrue supports **28+ AI coding agents** through **43 specialized exporters**. Each exporter generates agent-specific configuration files from your AlignTrue rules, ensuring your AI assistants stay aligned across your entire development workflow.

## Coverage statistics

- **43 total exporters** supporting **28+ agents**
- **8 MCP configurations** for protocol-based agents
- **15 unique format exporters** for agent-specific formats
- **11 universal format agents** using AGENTS.md
- **9 dual-output agents** with both universal + specific formats

This comprehensive coverage ensures AlignTrue rules work across the entire AI coding agent ecosystem, from established tools like Cursor and GitHub Copilot to emerging agents like Windsurf and Roo Code.

## Exporter categories

### 1. MCP (Model Context Protocol) Config Exporters

These generate JSON configuration files for agents that support the MCP protocol. MCP allows agents to connect to external tools and data sources. AlignTrue creates `.mcp.json` or equivalent files with rule-based guidance.

### 2. Agent-Specific Format Exporters

These create native configuration files or markdown formats specific to each agent (`.mdc`, `.md`, `.json`, `.yml`, etc.). Each format preserves agent-specific metadata and adapts rules to the agent's preferred structure.

### 3. Universal Format Exporters

AGENTS.md provides a single, universal markdown format that multiple agents can consume, reducing duplication while maintaining broad compatibility.

### 4. Dual-Output Agents

Some agents (like Aider) use both a universal format (AGENTS.md) AND their own specific config file for optimal results.

## Key features

- **Fidelity Notes**: Each exporter documents what information may be lost when converting from AlignTrue's IR format
- **Vendor Metadata**: Agent-specific extensions are preserved in `vendor.*` namespaces
- **Version Control**: All exporters are versioned and follow semantic versioning
- **Comprehensive Coverage**: Supports 28+ agents including Cursor, Claude, GitHub Copilot, Aider, and many others

## Full compatibility matrix

<div style="overflow-x: auto; max-width: 100%;">

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

</div>

## Extensibility

Built-in extensibility allows the community to [add support for new agents](/docs/05-contributing/adding-exporters). Each exporter follows a consistent pattern and can be contributed via pull request.

## Related documentation

- [CLI Reference](/docs/03-reference/cli-reference) - Commands for working with exporters
- [Adding Exporters](/docs/05-contributing/adding-exporters) - Guide for adding new agent support
- [Sync Behavior](/docs/02-concepts/sync-behavior) - How AlignTrue syncs rules to agents
