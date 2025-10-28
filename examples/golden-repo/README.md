# AlignTrue Golden Repository

This repository demonstrates AlignTrue in action with a complete, working example that you can clone and run in under 60 seconds.

## What's Inside

- **`.aligntrue/config.yaml`** - Configuration for solo mode with 3 exporters
- **`.aligntrue/rules.md`** - 5 example rules covering common development practices
- **`.cursor/rules/aligntrue.mdc`** - Generated Cursor rules (with content hash)
- **`AGENTS.md`** - Universal format for Claude, Copilot, Aider, and more
- **`.vscode/mcp.json`** - VS Code MCP configuration

## Quick Start

### 1. Clone and Navigate

```bash
# From the aligntrue repo root
cd examples/golden-repo
```

### 2. View the Rules

```bash
cat .aligntrue/rules.md
```

You'll see 5 practical rules:
- Testing best practices (error severity)
- Code review guidance (warn)
- Documentation standards (info)
- Security practices (error)
- TypeScript style (warn, with Cursor vendor metadata)

### 3. Sync Rules to Agents

```bash
# From aligntrue repo root
node ../../packages/cli/dist/index.js sync
```

Expected output:
```
✓ Sync complete
Wrote 3 files:
  - .cursor/rules/aligntrue.mdc
  - AGENTS.md
  - .vscode/mcp.json
```

### 4. Inspect the Outputs

**Cursor Rules:**
```bash
cat .cursor/rules/aligntrue.mdc
```

**Universal Format:**
```bash
cat AGENTS.md
```

**VS Code MCP Config:**
```bash
cat .vscode/mcp.json
```

Each output includes:
- All 5 rules in agent-specific format
- Content hash for integrity verification
- Fidelity notes explaining any format limitations

## Edit → Sync Workflow

### 1. Edit Rules

Open `.aligntrue/rules.md` and add a new rule or modify an existing one.

### 2. Sync Changes

```bash
node ../../packages/cli/dist/index.js sync
```

### 3. Verify Updates

```bash
# Check that outputs changed
git diff .cursor/rules/aligntrue.mdc AGENTS.md .vscode/mcp.json
```

The content hashes will update automatically, and fidelity notes will reflect any new unmapped fields.

## Advanced Features

### Dry Run Mode

Preview changes without writing files:

```bash
node ../../packages/cli/dist/index.js sync --dry-run
```

### Configuration

The `.aligntrue/config.yaml` shows a minimal solo mode setup:

```yaml
version: "1"
mode: solo

sources:
  - type: local
    path: .aligntrue/rules.md

exporters:
  - cursor
  - agents-md
  - vscode-mcp

git:
  mode: ignore
```

### Rule Format

Each rule in `.aligntrue/rules.md` can include:
- `id`: Unique identifier (kebab-case)
- `severity`: error, warn, or info
- `applies_to`: Glob patterns for file targeting
- `guidance`: Markdown-formatted explanation
- `vendor`: Agent-specific metadata (e.g., `vendor.cursor.ai_hint`)

## Expected Performance

- **Initial sync**: <5 seconds for 5 rules + 3 exporters
- **File generation**: 3 files totaling ~6KB
- **Deterministic**: Same inputs → same outputs → same hashes

## Validation

Run the validation script to verify everything works:

```bash
./test-golden-repo.sh
```

This checks:
- Config file exists and is valid
- Rules file exists and validates
- Sync succeeds
- All 3 output files are created
- Content hashes are present

## What's Next

- **Try team mode**: Enable lockfile for drift detection
- **Add more rules**: Extend `.aligntrue/rules.md` with your practices
- **Customize exporters**: Add or remove from the `exporters` list
- **Explore scopes**: Use hierarchical rules for monorepos

## Learn More

- [Quickstart Guide](../../docs/quickstart.md)
- [Command Reference](../../docs/commands.md)
- [Sync Behavior](../../docs/sync-behavior.md)
- [Extending AlignTrue](../../docs/extending-aligntrue.md)

