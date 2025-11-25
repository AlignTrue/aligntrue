# Multi-agent example

This example demonstrates syncing the same rules to multiple AI coding agents (Cursor, Copilot, Claude Code, Windsurf, and more).

## What's inside

- **`.aligntrue/config.yaml`** - Multiple exporters configuration
- **`AGENTS.md`** - Primary user-editable rules file with vendor bags for agent-specific hints
- **`.cursor/rules/*.mdc`** - Generated Cursor format (one file per rule)
- **`.github/copilot-instructions.md`** - Generated Copilot format
- **`.vscode/mcp.json`** - Generated VS Code MCP config
- **`COMPARISON.md`** - Side-by-side agent outputs
- **`test-multi-agent.sh`** - Validation script

## Quick start

### 1. View configuration

```bash
cat .aligntrue/config.yaml
```

You'll see multiple exporters:

- `cursor` - Cursor IDE
- `agents` - Universal format (Copilot, Claude Code, Aider)
- `github-copilot` - GitHub Copilot specific
- `vscode-mcp` - VS Code MCP config

### 2. View rules with vendor bags

```bash
cat AGENTS.md
```

Rules include vendor bags for agent-specific hints:

```yaml
vendor:
  cursor:
    ai_hint: "Cursor-specific hint"
  claude:
    mode: "assistant"
  copilot:
    suggestions: "detailed"
```

### 3. Sync to all agents

```bash
# From aligntrue repo root
cd examples/multi-agent
node ../../packages/cli/dist/index.js sync
```

Expected output:

```
✓ Sync complete
Wrote 7 files:
  - .cursor/rules/rule1.mdc
  - .cursor/rules/rule2.mdc
  - .cursor/rules/rule3.mdc
  - AGENTS.md
  - .github/copilot-instructions.md
  - .vscode/mcp.json
```

### 4. Compare agent outputs

```bash
# View Cursor format
ls -la .cursor/rules/
cat .cursor/rules/*.mdc

# View universal format
cat AGENTS.md

# View Copilot format
cat .github/copilot-instructions.md

# View VS Code MCP config
cat .vscode/mcp.json
```

Each file contains the same rules in agent-specific format with appropriate fidelity notes.

## Why multi-agent?

**Problem:** Using multiple AI agents means maintaining separate config files.

**Without AlignTrue:**

- Edit `.cursor/rules/*.mdc` for Cursor
- Edit `AGENTS.md` for Copilot
- Edit `.aider.conf.yml` for Aider
- Changes in one don't sync to others
- Rules drift over time

**With AlignTrue:**

- Edit `AGENTS.md` once
- Run `aligntrue sync`
- All agents get updated automatically
- Rules stay consistent

## Vendor bags

Vendor bags allow agent-specific customization without duplicating rules.

### Example: Different AI hints per agent

```yaml
rules:
  - id: require-tests
    summary: All features must have tests
    severity: error
    guidance: |
      Write unit tests for all new features.
    vendor:
      cursor:
        ai_hint: "Suggest test file path and basic test structure"
        quick_fix: true
      claude:
        mode: "reviewer"
        context: "Emphasize test coverage and edge cases"
      copilot:
        suggestions: "detailed"
        examples: true
```

**Result:**

- All agents enforce the rule
- Each agent gets customized hints
- Core rule logic stays consistent

## Agent comparison

### Cursor

**Format:** `.cursor/rules/*.mdc` (one file per rule)

**Features:**

- Full rule support
- Vendor bag hints
- Content hash verification
- Fidelity notes

**Best for:** Primary development IDE

### Universal (AGENTS.md)

**Format:** `AGENTS.md`

**Features:**

- Works with most agents (Copilot, Claude Code, Aider, Windsurf)
- Simple markdown format
- Content hash verification
- Fidelity notes for unsupported features

**Best for:** Maximum compatibility

### GitHub Copilot

**Format:** `.github/copilot-instructions.md`

**Features:**

- Copilot-optimized format
- Suggestion levels
- Example code
- Content hash verification

**Best for:** GitHub Copilot users

### VS Code MCP

**Format:** `.vscode/mcp.json`

**Features:**

- MCP server configuration
- Tool definitions
- Resource mappings
- Content hash verification

**Best for:** VS Code with MCP extensions

## Commands reference

### Sync to all agents

```bash
aligntrue sync
```

### Dry run (preview changes)

```bash
aligntrue sync --dry-run
```

### List configured exporters

```bash
aligntrue config get exporters
```

### Add new exporter

```bash
aligntrue config set exporters.4 windsurf
```

## Workflow

### IR-source workflow (recommended)

Edit `AGENTS.md` as single source of truth:

```bash
# 1. Edit rules
vi AGENTS.md

# 2. Sync to all agents
aligntrue sync

# 3. Commit changes
git add .aligntrue/ .cursor/ AGENTS.md .github/ .vscode/
git commit -m "Update rules"
```

**Why this works:**

- Single source of truth
- No conflicts between agents
- Clear edit → sync → deploy flow

## Fidelity notes

Each exporter includes fidelity notes explaining format limitations.

### Example fidelity notes

**AGENTS.md:**

```
Fidelity Notes:
- Machine-checkable rules (check) not represented in AGENTS.md format
- Autofix hints not represented in AGENTS.md format
- Vendor-specific metadata preserved but not active in universal format
```

**Cursor:**

```
Fidelity Notes:
- applies_to patterns preserved in metadata but not enforced by Cursor
```

**Copilot:**

```
Fidelity Notes:
- Severity levels mapped to suggestion priority
- Machine-checkable rules (check) not supported
```

## Validation

Run the test script to verify everything works:

```bash
./test-multi-agent.sh
```

This checks:

- Config file exists with multiple exporters
- Rules file exists with vendor bags
- Sync succeeds
- All 4 output files are created
- Content hashes are present
- Vendor bags are preserved

## See also

- [Multi-agent workflows guide](../../apps/docs/content/01-guides/05-multi-agent-workflows.md) - Complete multi-agent documentation
- [Vendor bags reference](../../apps/docs/content/04-reference/vendor-bags.md) - Agent-specific metadata
- [COMPARISON.md](./COMPARISON.md) - Detailed agent comparison
- [Golden repo example](../golden-repo/) - Solo developer workflow
