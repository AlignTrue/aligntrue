---
description: Manage exporters for 43+ AI coding agents
---

# Exporters

Discover, enable, and disable exporters for AI agents. AlignTrue supports 43+ agents including Cursor, Claude, Windsurf, VS Code, and more.

## `aligntrue exporters`

Manage exporters in your configuration. View, enable, and disable exporters for 43+ supported AI coding agents.

**Usage:**

```bash
aligntrue exporters <subcommand>
```

**Subcommands:**

- `list` - Show all available exporters with install status
- `enable <exporter>` - Enable an exporter in config
- `enable --interactive` - Choose exporters with multiselect UI
- `disable <exporter>` - Disable an exporter in config
- `detect` - Manually detect new agents in workspace
- `ignore <exporter>` - Add agent to ignored list (no detection prompts)

---

### `aligntrue exporters list`

Show all discovered exporters with their current install status.

**Usage:**

```bash
aligntrue exporters list
```

**Status indicators:**

- `✓` **Installed** - Enabled in your `.aligntrue/config.yaml`
- `-` **Available** - Discovered but not enabled
- `❌` **Invalid** - In config but not found (shows warning, non-blocking)

**Example output:**

```
Available exporters (44 total):

✓ cursor                  Export AlignTrue rules to Cursor .mdc format
                          Outputs: .cursor/rules/*.mdc

✓ agents               Export AlignTrue rules to universal AGENTS.md format
                          Outputs: AGENTS.md

- claude               Export AlignTrue rules to Claude CLAUDE.md format
                          Outputs: CLAUDE.md

- vscode-mcp              Export AlignTrue rules to VS Code MCP configuration
                          Outputs: .vscode/mcp.json

- windsurf-mcp            Export AlignTrue rules to Windsurf MCP configuration
                          Outputs: .windsurf/mcp_config.json

❌ nonexistent-exporter     (Not found in available exporters)

Summary:
  ✓ Installed: 2
  - Available: 41
  ❌ Invalid: 1
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue exporters enable`

Enable one or more exporters by adding them to your config.

**Single exporter:**

```bash
aligntrue exporters enable <exporter>
```

**Interactive mode:**

```bash
aligntrue exporters enable --interactive
# or
aligntrue exporters enable -i
```

**What it does:**

1. Validates exporter exists in discovered manifests
2. Checks if already enabled (shows friendly message, exits 0)
3. Adds to `config.exporters` array (sorted alphabetically)
4. Saves config atomically (temp + rename)
5. Shows success message and next steps

**Interactive mode features:**

- Visual multiselect UI powered by @clack/prompts
- Pre-selects currently enabled exporters
- Toggle any available exporter
- Shows exporter descriptions and output paths
- Cancel-safe (Ctrl+C exits cleanly)

**Examples:**

```bash
# Enable a single exporter
aligntrue exporters enable claude

# Enable multiple exporters interactively
aligntrue exporters enable --interactive

# Already enabled (idempotent)
aligntrue exporters enable cursor
# Output: ✓ Exporter already enabled: cursor
```

**Example output:**

```
✓ Enabled exporter: claude

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success (or already enabled)
- `1` - Exporter not found, config error, or invalid exporter

---

### `aligntrue exporters disable`

Disable an exporter by removing it from your config.

**Usage:**

```bash
aligntrue exporters disable <exporter>
```

**Safety features:**

- Cannot disable last exporter (at least one must be configured)
- Validates exporter is currently enabled
- Shows clear error messages with actionable fixes

**Examples:**

```bash
# Disable an exporter
aligntrue exporters disable claude

# Cannot disable last exporter
aligntrue exporters disable cursor
# Error: Cannot disable last exporter
#   At least one exporter must be configured
#   Enable another exporter first: aligntrue exporters enable <exporter>

# Not enabled
aligntrue exporters disable nonexistent
# Error: Exporter not enabled: nonexistent
#   Run: aligntrue exporters list
```

**Example output:**

```
✓ Disabled exporter: claude
```

**Exit codes:**

- `0` - Success
- `1` - Exporter not enabled, last exporter, or config error

---

### `aligntrue exporters detect`

Manually detect new agents in your workspace. Shows agents that have files present but are not yet in config and not on the ignored list.

**Usage:**

```bash
aligntrue exporters detect
```

**What it does:**

1. Scans workspace for agent-specific files (`.cursor/`, `AGENTS.md`, `.windsurf/`, etc.)
2. Filters out agents already in config
3. Filters out agents on the ignored list
4. Displays new agents with their file paths
5. Shows commands to enable or ignore each agent

**Example output:**

```
Detected 2 new agent(s):

  - Windsurf
    File: .windsurf/rules.md
  - GitHub Copilot
    File: AGENTS.md

To enable:
  aligntrue exporters enable <agent-name>

To ignore:
  aligntrue exporters ignore <agent-name>
```

**No new agents:**

```
✓ No new agents detected

All detected agents are already enabled or ignored.
```

**Use case:**

Run after installing a new AI coding agent to see if AlignTrue can export to it automatically.

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue exporters ignore`

Add an agent to the ignored list so it never triggers detection prompts during sync.

**Usage:**

```bash
aligntrue exporters ignore <agent>
```

**What it does:**

1. Validates config exists
2. Checks if agent already ignored (shows message, exits 0)
3. Adds agent to `detection.ignored_agents` array in config
4. Saves config atomically
5. Shows success message

**Examples:**

```bash
# Ignore an agent
aligntrue exporters ignore windsurf

# Already ignored
aligntrue exporters ignore windsurf
# Output: ✓ Agent already ignored: windsurf
```

**Example output:**

```
✓ Added to ignored list: windsurf

This agent will no longer trigger prompts during sync.
```

**Config result:**

```yaml
detection:
  ignored_agents:
    - windsurf
```

**Use case:**

Prevent prompts for agents you don't use even though their files exist in your workspace.

**Exit codes:**

- `0` - Success
- `1` - Missing agent name or config error

---

## Supported exporters

AlignTrue supports 43+ AI coding agents across multiple platforms:

**Mainstream:**

- Cursor
- Claude Code (Anthropic)
- GitHub Copilot
- Windsurf (Codeium)
- VS Code MCP
- Cline (VS Code Extension)

**And 37+ more**, including: Amazon Q, Google Gemini, Zed, Aider, Roo Code, Jules, Augment Code, Open Hands, Junie, Kilocode, Kiro, Crush, Firebender, Firebase Studio, Goose, Trae AI, Warp, and others.

For the complete and updated list, run:

```bash
aligntrue exporters list
```

---

## Workflow examples

### View available exporters

```bash
aligntrue exporters list
```

### Enable an exporter interactively

```bash
aligntrue exporters enable --interactive
```

### Enable specific exporter

```bash
aligntrue exporters enable claude
aligntrue sync
```

### Disable an exporter

```bash
aligntrue exporters disable windsurf
aligntrue sync
```

### Check for new agents

```bash
# After installing a new agent
aligntrue exporters detect

# Enable it if found
aligntrue exporters enable <agent-name>
```

### Prevent detection prompts for unused agents

```bash
# Ignore an agent you don't use
aligntrue exporters ignore amazon-q

# It won't trigger prompts during sync
aligntrue sync
```

---

## See also

- [Status command](/docs/04-reference/cli-reference/core#aligntrue-status) to see currently enabled exporters
- [Sync command](/docs/04-reference/cli-reference/core#aligntrue-sync) to export rules to agents
- [Init command](/docs/04-reference/cli-reference/core#aligntrue-init) for initial exporter selection
