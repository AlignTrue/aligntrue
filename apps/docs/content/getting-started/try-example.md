# Try the example

See AlignTrue in action with a complete working example. This guide walks you through a realistic setup in under 5 minutes.

## Quick demo

The fastest way to see AlignTrue work is to create a test project and let it generate everything for you.

### 1. Create a test directory

Create a new directory for testing (run this in your terminal):

```bash
mkdir aligntrue-demo && cd aligntrue-demo
```

### 2. Initialize AlignTrue

Run this command in your test directory:

```bash
npx @aligntrue/cli@latest init
```

This will:

- Detect any AI agents in your workspace (or prompt you to choose)
- Create `.aligntrue/config.yaml` with sensible defaults
- Generate `.aligntrue/rules.md` with 5 practical example rules

### 3. Review the generated files

**Check the configuration:**

```bash
cat .aligntrue/config.yaml
```

You'll see something like:

```yaml
spec_version: "1"
profile:
  id: aligntrue-demo
  version: "1.0.0"
exporters:
  - cursor
  - agents-md
```

**Check the rules:**

```bash
cat .aligntrue/rules.md
```

The starter template includes:

- Code style rules
- Testing requirements
- Documentation standards
- Security practices
- AI-specific guidance

### 4. Generate agent files

```bash
npx @aligntrue/cli@latest sync
```

**What gets created:**

For Cursor users:

```
.cursor/rules/aligntrue.mdc
```

For all AI agents:

```
AGENTS.md
```

For VS Code with MCP (if enabled):

```
.vscode/mcp.json
```

### 5. Inspect the output

**View Cursor rules:**

```bash
cat .cursor/rules/aligntrue.mdc
```

**View universal format:**

```bash
cat AGENTS.md
```

Notice how AlignTrue includes:

- Content hash for integrity verification
- Exporter version for debugging
- Clear rule organization
- Agent-specific formatting

## Example project structure

After running the demo, you'll have:

```
aligntrue-demo/
├── .aligntrue/
│   ├── config.yaml          # Configuration
│   └── rules.md             # Source rules
├── .cursor/
│   └── rules/
│       └── aligntrue.mdc    # Cursor format
└── AGENTS.md                # Universal format
```

## Understanding the example

### The config file

The configuration tells AlignTrue:

- Which agents to export to (`exporters`)
- Your project identity (`profile`)
- Schema version for validation (`spec_version`)

### The rules file

Rules are written in markdown with embedded YAML:

````markdown
```aligntrue
id: my-project.testing.required
version: "1.0.0"
spec_version: "1"
rules:
  - id: tests-required
    summary: All features must have tests
    severity: error
```
````

### The exported files

AlignTrue converts your rules to each agent's preferred format while maintaining semantic consistency.

## Try modifying rules

### 1. Edit a rule

Open `.aligntrue/rules.md` and change a rule:

```yaml
- id: use-typescript-strict
  summary: Use TypeScript strict mode everywhere # Changed this
  severity: error
```

### 2. Sync again

```bash
npx @aligntrue/cli@latest sync
```

### 3. Compare the output

```bash
cat .cursor/rules/aligntrue.mdc
```

Notice the content hash changed - AlignTrue tracks changes for integrity.

## Common commands

**Preview changes without writing files:**

```bash
aligntrue sync --dry-run
```

**Validate your rules:**

```bash
aligntrue check
```

**See what agents are supported:**

```bash
aligntrue adapters list
```

## Next steps

**Ready to use AlignTrue in a real project?** See the [Quickstart Guide](/getting-started/quickstart) for production setup.

**Want to explore advanced features?** Check out [Next Steps](/getting-started/next-steps) for team mode, git sources, and auto-sync.

**Exploring the golden repository example?** The AlignTrue repo includes a complete example at `examples/golden-repo/` with:

- 5 practical rules
- Multiple agent exports
- Real-world configuration

To explore it:

```bash
git clone https://github.com/AlignTrue/aligntrue.git
cd aligntrue/examples/golden-repo
cat README.md
```

---

**Questions?** See [Troubleshooting](/reference/troubleshooting) or [open an issue](https://github.com/AlignTrue/aligntrue/issues).
