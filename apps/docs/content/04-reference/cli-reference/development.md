# Development commands

Tools for working with markdown rules, managing adapters, and validating syntax.

## Markdown commands overview

**Important distinction:**

- **For authoring:** Use fenced ```aligntrue blocks in your own markdown files
- **For generated files:** AlignTrue automatically uses HTML comment markers for round-trip fidelity
- **To edit generated files:** Use `aligntrue import` to pull changes back to IR, not the md commands

**Authoring workflow:**

````markdown
# My Rules

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: style.naming
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Use camelCase for functions
```
````

Then use `aligntrue md lint`, `aligntrue md compile`, and `aligntrue md format` to work with these authored files.

**Generated workflow:**

```markdown
# AGENTS.md

<!-- aligntrue:begin {"id":"style.naming"} -->

## Rule: style.naming

**ID:** style.naming
...

<!-- aligntrue:end -->
```

To edit these files, use `aligntrue import` or edit directly and run `aligntrue sync --accept-agent agents-md`.

---

## `aligntrue adapters`

Manage exporters (adapters) in your configuration. View, enable, and disable adapters for 43 supported AI coding agents.

**Usage:**

```bash
aligntrue adapters <subcommand>
```

**Subcommands:**

- `list` - Show all available adapters with install status
- `enable <adapter>` - Enable an adapter in config
- `enable --interactive` - Choose adapters with multiselect UI
- `disable <adapter>` - Disable an adapter in config
- `detect` - Manually detect new agents in workspace
- `ignore <adapter>` - Add agent to ignored list (no detection prompts)

---

### `aligntrue adapters list`

Show all 43 discovered adapters with their current install status.

**Usage:**

```bash
aligntrue adapters list
```

**Status indicators:**

- `✓` **Installed** - Enabled in your `.aligntrue/config.yaml`
- `-` **Available** - Discovered but not enabled
- `❌` **Invalid** - In config but not found (shows warning, non-blocking)

**Example output:**

```
Available Adapters (44 total):

✓ cursor                  Export AlignTrue rules to Cursor .mdc format
                          Outputs: .cursor/rules/*.mdc

✓ agents-md               Export AlignTrue rules to universal AGENTS.md format
                          Outputs: AGENTS.md

- claude-md               Export AlignTrue rules to Claude CLAUDE.md format
                          Outputs: CLAUDE.md

- vscode-mcp              Export AlignTrue rules to VS Code MCP configuration
                          Outputs: .vscode/mcp.json

- windsurf-mcp            Export AlignTrue rules to Windsurf MCP configuration
                          Outputs: .windsurf/mcp_config.json

❌ nonexistent-adapter     (Not found in available adapters)

Summary:
  ✓ Installed: 2
  - Available: 41
  ❌ Invalid: 1
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue adapters enable`

Enable one or more adapters by adding them to your config.

**Single adapter:**

```bash
aligntrue adapters enable <adapter>
```

**Interactive mode:**

```bash
aligntrue adapters enable --interactive
# or
aligntrue adapters enable -i
```

**What it does:**

1. Validates adapter exists in discovered manifests
2. Checks if already enabled (shows friendly message, exits 0)
3. Adds to `config.exporters` array (sorted alphabetically)
4. Saves config atomically (temp + rename)
5. Shows success message and next steps

**Interactive mode features:**

- Visual multiselect UI powered by @clack/prompts
- Pre-selects currently enabled adapters
- Toggle any available adapter
- Shows adapter descriptions and output paths
- Cancel-safe (Ctrl+C exits cleanly)

**Examples:**

```bash
# Enable a single adapter
aligntrue adapters enable claude-md

# Enable multiple adapters interactively
aligntrue adapters enable --interactive

# Already enabled (idempotent)
aligntrue adapters enable cursor
# Output: ✓ Adapter already enabled: cursor
```

**Example output:**

```
✓ Enabled adapter: claude-md

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success (or already enabled)
- `1` - Adapter not found, config error, or invalid adapter

---

### `aligntrue adapters disable`

Disable an adapter by removing it from your config.

**Usage:**

```bash
aligntrue adapters disable <adapter>
```

**Safety features:**

- Cannot disable last adapter (at least one must be configured)
- Validates adapter is currently enabled
- Shows clear error messages with actionable fixes

**Examples:**

```bash
# Disable an adapter
aligntrue adapters disable claude-md

# Cannot disable last adapter
aligntrue adapters disable cursor
# Error: Cannot disable last adapter
#   At least one exporter must be configured
#   Enable another adapter first: aligntrue adapters enable <adapter>

# Not enabled
aligntrue adapters disable nonexistent
# Error: Adapter not enabled: nonexistent
#   Run: aligntrue adapters list
```

**Example output:**

```
✓ Disabled adapter: claude-md
```

**Exit codes:**

- `0` - Success
- `1` - Adapter not enabled, last adapter, or config error

---

### `aligntrue adapters detect`

Manually detect new agents in your workspace. Shows agents that have files present but are not yet in config and not on the ignored list.

**Usage:**

```bash
aligntrue adapters detect
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
  aligntrue adapters enable <agent-name>

To ignore:
  aligntrue adapters ignore <agent-name>
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

### `aligntrue adapters ignore`

Add an agent to the ignored list so it never triggers detection prompts during sync.

**Usage:**

```bash
aligntrue adapters ignore <agent>
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
aligntrue adapters ignore windsurf

# Already ignored
aligntrue adapters ignore windsurf
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

## `aligntrue md lint`

Check markdown syntax in `AGENTS.md` or agent files.

**Usage:**

```bash
aligntrue md lint [file]
```

**What it validates:**

- Fenced code blocks use `aligntrue` language tag
- One block per markdown section (no multiple blocks)
- Valid YAML inside fenced blocks
- Schema compliance for rules

**Examples:**

```bash
# Lint default rules file
aligntrue md lint

# Lint specific file
aligntrue md lint custom-rules.md
```

**Exit codes:**

- `0` - Valid markdown
- `1` - Syntax errors found
- `2` - File not found

---

## `aligntrue md format`

Format markdown rules file with consistent style.

**Usage:**

```bash
aligntrue md format [file]
```

**What it does:**

- Normalizes whitespace (tabs → spaces, trim trailing)
- Ensures consistent EOF newline
- Preserves guidance prose and structure

**Examples:**

```bash
# Format default rules file
aligntrue md format

# Format specific file
aligntrue md format custom-rules.md
```

---

## `aligntrue md compile`

Compile markdown to intermediate representation (IR) for validation.

**Usage:**

```bash
aligntrue md compile [file]
```

**What it does:**

- Extracts fenced `aligntrue` blocks
- Compiles to internal IR format
- Validates against schema
- Outputs JSON IR to stdout

**Examples:**

```bash
# Compile to IR
aligntrue md compile

# Compile and save to file
aligntrue md compile > rules.json
```

---

## `aligntrue md generate`

Generate markdown from YAML (round-trip workflow).

**Usage:**

```bash
aligntrue md generate <file> [--output <path>] [--preserve-style] [--canonical] [--header <text>]
```

**Flags:**

- `--output, -o` - Output file path (default: stdout)
- `--preserve-style` - Use `_markdown_meta` if present (default: true)
- `--canonical` - Force canonical formatting (ignore metadata)
- `--header <text>` - Custom header text

**What it does:**

- Reads YAML file (aligntrue.yaml or custom IR)
- Generates markdown with fenced `aligntrue` block
- Preserves original formatting if metadata available
- Supports custom headers and indent styles

**Examples:**

```bash
# Generate markdown (stdout)
aligntrue md generate aligntrue.yaml

# Generate and save to file
aligntrue md generate aligntrue.yaml --output AGENTS.md

# Generate with custom header
aligntrue md generate aligntrue.yaml --header "## My Project Rules"

# Force canonical format (ignore metadata)
aligntrue md generate aligntrue.yaml --canonical
```

**Round-trip workflow:**

```bash
# Start with markdown
aligntrue md compile AGENTS.md --output aligntrue.yaml

# Edit YAML as needed

# Generate back to markdown
aligntrue md generate aligntrue.yaml --output AGENTS.md --preserve-style
```

**Output format:**

````markdown
# AlignTrue Rules

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]
```
````
