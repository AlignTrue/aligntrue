---
title: MCP support
description: Complete guide to AlignTrue's Model Context Protocol (MCP) implementation across 14+ AI coding agents
---

# MCP support

AlignTrue supports **Model Context Protocol (MCP)** configuration across **14+ AI coding agents**. MCP enables AI agents to connect to external tools, data sources, and services through a standardized protocol.

## What is MCP?

Model Context Protocol allows AI agents to:

- Access external tools and resources
- Integrate with project-specific services
- Extend agent capabilities beyond training data
- Connect to custom APIs and data sources

AlignTrue automatically generates agent-specific MCP configuration files from your rules, ensuring consistent tool access across your development workflow.

## Supported MCP agents

AlignTrue exports MCP configuration for 14 agents across 6 format types:

### JSON-based MCP configurations

| Agent           | Exporter          | Config File                 | Notes                    |
| --------------- | ----------------- | --------------------------- | ------------------------ |
| GitHub Copilot  | `vscode-mcp`      | `.vscode/mcp.json`          | VS Code integration      |
| Cursor          | `cursor-mcp`      | `.cursor/mcp.json`          | Cursor-specific setup    |
| Claude Code     | `root-mcp`        | `.mcp.json`                 | Root-level config        |
| Aider           | `root-mcp`        | `.mcp.json`                 | Shared with Claude Code  |
| Windsurf        | `windsurf-mcp`    | `.windsurf/mcp_config.json` | Windsurf-specific format |
| Amazon Q        | `amazonq-mcp`     | `.amazonq/mcp.json`         | AWS integration          |
| Firebase Studio | `firebase-mcp`    | `.idx/mcp.json`             | Firebase IDX platform    |
| KiloCode        | `kilocode-mcp`    | `.kilocode/mcp.json`        | KiloCode-specific        |
| Roo Code        | `roocode-mcp`     | `.roo/mcp.json`             | Roo Code format          |
| Amp             | `amp-mcp`         | `.amp/settings.json`        | Project-level settings   |
| AugmentCode     | `augmentcode-mcp` | `.augment/settings.json`    | Augment platform         |
| Kiro            | `kiro-mcp`        | `.kiro/settings/mcp.json`   | Kiro settings directory  |

### YAML-based MCP configurations

| Agent   | Exporter     | Config File          | Notes                      |
| ------- | ------------ | -------------------- | -------------------------- |
| Goose   | `goose-mcp`  | `.goose/config.yaml` | YAML format for extensions |
| Trae AI | `traeai-mcp` | `trae_config.yaml`   | Project root (git-ignored) |

### Special MCP handling

| Agent | Exporter    | Config File           | Notes                         |
| ----- | ----------- | --------------------- | ----------------------------- |
| Junie | `junie-mcp` | `.junie/mcp/mcp.json` | Directory-based MCP structure |

## Central MCP configuration

AlignTrue uses a centralized MCP configuration in `.aligntrue/config.yaml`:

```yaml
mcp:
  servers:
    - name: my-custom-server
      command: python
      args: ["./tools/custom-mcp.py"]
      env:
        API_KEY: "${process.env.CUSTOM_API_KEY}"
    - name: nodejs-server
      command: node
      args: ["./mcp-server.js"]
```

This central definition is propagated to agent-specific MCP configuration files automatically during sync.

## Exporter capabilities

Each MCP exporter:

- Reads MCP server definitions from `.aligntrue/config.yaml`
- Generates agent-specific MCP server configuration files
- Propagates your centralized server definitions to each agent's required format
- Includes content hash for determinism and verification
- Supports vendor-specific customizations

## Configuration schema

MCP servers require:

- **name** (required): Unique identifier (e.g., `aligntrue`)
- **command** (required): Executable command (e.g., `npx`, `python`, `node`)
- **args** (optional): Command arguments as array
- **env** (optional): Environment variables as object
- **disabled** (optional): Temporarily disable without removing config

## Format differences

### JSON vs YAML

**JSON-based** (most agents):

- Consistent structure across platforms
- Easier parsing and validation
- Direct MCP protocol representation

**YAML-based** (Goose, Trae):

- Human-readable format
- Easier manual editing
- Agent-specific customizations

## Project-level only

By design, AlignTrue writes MCP configuration only to project-level files:

- `.vscode/mcp.json` (not global VS Code settings)
- `.cursor/mcp.json` (not global Cursor config)
- `.goose/config.yaml` (not global `~/.config/goose/config.yaml`)

This approach:

- Keeps rules version-controlled and reviewable
- Enables team collaboration on shared MCP config
- Prevents machine-specific drift
- Works with monorepos and scoped rules

If you need global MCP configuration, copy the project-level file to your global config location manually.

## Fidelity notes

When MCP features cannot be fully represented, exporters include fidelity notes:

```json
{
  "fidelity_notes": [
    "Section 'Performance': machine-checkable checks not represented in MCP format"
  ]
}
```

These notes indicate:

- Information loss during export
- Unsupported features for this agent
- Recommendations for manual customization

## Determinism

All MCP exports are deterministic:

- Same input (rules + config) → identical MCP JSON
- Content hash included for verification
- Order preserved across exports
- Reproducible across machines and CI

## Related documentation

- [Agent Support](/docs/04-reference/agent-support) - Full compatibility matrix
- [AI Agent Guide](/docs/04-reference/ai-agent-guide) - Quick reference for all agents
- [Sync Behavior](/docs/03-concepts/sync-behavior) - How MCP configs sync
- [MCP Protocol](https://modelcontextprotocol.io) - Official MCP specification
