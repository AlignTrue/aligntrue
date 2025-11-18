# AlignTrue Golden Repository

This repository demonstrates AlignTrue in action with a complete, working example that you can clone and run in under 60 seconds.

## What's Inside

- **`.aligntrue/config.yaml`** - Minimal solo mode configuration (2 lines)
- **`.aligntrue/.rules.yaml`** - Internal IR file (auto-generated, don't edit directly)
- **`AGENTS.md`** - Primary user-editable file with 5 example rules
- **`.cursor/rules/aligntrue.mdc`** - Generated Cursor rules (with content hash)
- **`.vscode/mcp.json`** - VS Code MCP configuration

## Solo Developer Workflow

This repository demonstrates the **agent-format-first workflow** for solo developers:

1. **Edit rules in your preferred format** (`AGENTS.md` or `.cursor/*.mdc`)
2. **Save changes**
3. **Run sync** (auto-pulls from primary agent, pushes to all others)

No YAML knowledge required! The internal IR (`.aligntrue/.rules.yaml`) is generated automatically.

## Quick Start

### 1. Clone and Navigate

```bash
# From the aligntrue repo root
cd examples/golden-repo
```

### 2. View the Rules

```bash
cat AGENTS.md
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

Open `AGENTS.md` and add a new rule or modify an existing one.

### 2. Sync Changes

```bash
node ../../packages/cli/dist/index.js sync
```

### 3. Verify Updates

```bash
# Check that outputs changed
git diff .cursor/rules/aligntrue.mdc .vscode/mcp.json .aligntrue/.rules.yaml
```

The content hashes will update automatically, and the internal IR (`.aligntrue/.rules.yaml`) will be regenerated.

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
    path: .aligntrue/.rules.yaml

exporters:
  - cursor
  - agents
  - vscode-mcp

sync:
  auto_pull: true
  primary_agent: cursor

git:
  mode: ignore
```

**Note:** The `sources` path points to `.aligntrue/.rules.yaml` (internal IR), but users should edit `AGENTS.md` or agent files directly. The IR is auto-generated during sync.

### Rule Format

Each rule in `AGENTS.md` includes:

- `ID`: Unique identifier (dot notation, e.g., `testing.require.tests`)
- `Severity`: ERROR, WARN, or INFO (uppercase in AGENTS.md)
- `Scope`: File patterns the rule applies to
- `Guidance`: Markdown-formatted explanation with examples

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

## What's next

- **Try overlays**: See [overlays-demo](../overlays-demo/) for fork-safe customization
- **Try scopes**: See [monorepo-scopes](../monorepo-scopes/) for path-based rules
- **Try multi-agent**: See [multi-agent](../multi-agent/) for syncing to multiple agents
- **Try team mode**: See [team-repo](../team-repo/) for lockfile and drift detection

## Related examples

- **[Overlays demo](../overlays-demo/)** - Fork-safe customization without forking
- **[Monorepo scopes](../monorepo-scopes/)** - Path-based rules for monorepos
- **[Multi-agent](../multi-agent/)** - Same rules, multiple agents
- **[Team repo](../team-repo/)** - Team mode with lockfile and drift detection
- **[Markdown examples](../markdown/)** - Literate markdown authoring

## Learn more

- [Quickstart Guide](../../docs/quickstart.md)
- [Command Reference](../../docs/commands.md)
- [Sync Behavior](../../docs/sync-behavior.md)
- [Extending AlignTrue](../../docs/extending-aligntrue.md)
