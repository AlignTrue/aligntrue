# Basic commands

Essential commands for working with AlignTrue: initialization, syncing, and exporter management.

## `aligntrue exporters`

Manage exporters for AI coding agents. View, enable, and disable exporters for 43+ supported AI coding agents.

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

Show all 43+ discovered exporters with their current install status.

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
Available Exporters (44 total):

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

**Learn more at https://aligntrue.ai/exporters**

---

## `aligntrue remove`

Remove a linked source from your configuration.

**Usage:**

```bash
aligntrue remove <url>
```

**Arguments:**

- `<url>` - The git URL to remove (must match exactly as configured)

**Examples:**

```bash
# Remove a linked source
aligntrue remove https://github.com/org/rules

# Then sync to apply changes
aligntrue sync
```

**What it does:**

1. Finds matching source in `config.yaml`
2. Removes from `sources` array
3. Saves config atomically

**Exit codes:**

- `0` - Success
- `1` - Source not found or config error

---

## `aligntrue sources`

Manage rule sources. View status, update caches, and pin versions.

**Usage:**

```bash
aligntrue sources <subcommand> [options]
```

**Subcommands:**

- `list` - Show all configured sources
- `status` - Detailed status with cache info
- `detect` - Find untracked agent files
- `update` - Force refresh git sources
- `pin` - Pin source to specific commit/tag

---

### `aligntrue sources list`

Show all configured sources with their types and paths.

**Usage:**

```bash
aligntrue sources list
```

**Example output:**

```
Configured sources:
  1. .aligntrue/rules/ (local)
  2. https://github.com/company/standards (git)
  3. https://github.com/team/extras@v2.0.0 (git)

Total: 3 sources
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue sources status`

Detailed status including cached SHA, last fetch time, and cache health.

**Usage:**

```bash
aligntrue sources status
```

**Example output:**

```
Source status:

https://github.com/company/rules
  Cache: .aligntrue/.cache/git/abc123...
  Cached SHA: abc1234567890def
  Last fetched: 2025-01-15T10:30:00Z
  Cache status: Valid

https://github.com/team/extras@v2.0.0
  Cache: .aligntrue/.cache/git/def456...
  Cached SHA: def4567890abcdef
  Last fetched: 2025-01-14T15:20:00Z
  Cache status: Valid
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue sources detect`

Find agent files not tracked by AlignTrue. Use `--import` to import them.

**Usage:**

```bash
aligntrue sources detect
aligntrue sources detect --import
```

**Options:**

- `--import` - Auto-import detected files to `.aligntrue/rules/`
- `--yes` - Auto-confirm prompts in non-interactive mode

**Examples:**

```bash
# List untracked files
aligntrue sources detect

# Import detected files
aligntrue sources detect --import
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue sources update`

Force refresh git sources, bypassing cache TTL.

**Usage:**

```bash
aligntrue sources update <url>
aligntrue sources update --all
```

**Options:**

- `<url>` - Update specific source
- `--all` - Update all git sources

**Examples:**

```bash
# Update specific source
aligntrue sources update https://github.com/company/rules

# Update all git sources
aligntrue sources update --all
```

**What it does:**

1. Clears cache for specified source(s)
2. Fetches fresh copy from git
3. Updates local cache
4. Does not run sync (manual sync required)

**Exit codes:**

- `0` - Success
- `1` - Source not found or network error

---

### `aligntrue sources pin`

Pin a git source to a specific commit or tag.

**Usage:**

```bash
aligntrue sources pin <url> <ref>
```

**Arguments:**

- `<url>` - The git source URL
- `<ref>` - Commit SHA, branch, or tag to pin to

**Examples:**

```bash
# Pin to tag
aligntrue sources pin https://github.com/company/rules v1.3.0

# Pin to specific commit
aligntrue sources pin https://github.com/company/rules abc1234567890def

# Pin to branch
aligntrue sources pin https://github.com/company/rules main
```

**What it does:**

1. Updates source ref in `config.yaml`
2. Clears cache
3. Does not run sync (manual sync required)

**Exit codes:**

- `0` - Success
- `1` - Source not found or invalid ref

**See also:**

- [Git sources guide](/docs/04-reference/git-sources) - Complete guide to git sources and workflows
- [Managing sources](/docs/04-reference/git-sources#managing-sources) - Source management workflows
