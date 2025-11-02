# Extending AlignTrue

Guide for contributing new exporters and extending AlignTrue to support additional AI coding agents.

## Overview

AlignTrue supports 28+ AI coding agents through a hybrid manifest system. Adding support for a new agent typically takes 1-2 hours and requires:

1. A JSON manifest describing the exporter
2. (Optional) A TypeScript handler for custom export logic
3. Tests validating the output format

### When to create a new exporter

**Create a new exporter when:**

- The agent uses a unique file format (e.g., `.cursor/*.mdc`, `.clinerules`)
- The agent requires specific metadata or configuration
- The agent has special formatting requirements

**Use an existing exporter when:**

- The agent reads `AGENTS.md` (works for 11+ agents)
- The agent follows a standard config format you can adapt

### Exporter types

AlignTrue supports three main patterns:

1. **Single file at root** - `AGENTS.md`, `CLAUDE.md`, `CRUSH.md`
2. **Directory-based** - `.cursor/rules/*.mdc`, `.kilocode/rules/*.md`
3. **Config file** - `.vscode/mcp.json`, `.crush.json`
4. **Dual output** - Rules file + config file (e.g., Cursor + MCP)

## Quick start

### 1. Create manifest

Create `packages/exporters/src/<agent-name>/manifest.json`:

```json
{
  "name": "my-agent",
  "version": "1.0.0",
  "description": "Export rules to My Agent format",
  "author": "Your Name <your.email@example.com>",
  "outputPaths": [".myagent/rules.md"],
  "handlerPath": "./index.js",
  "schema": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean", "default": true }
    }
  }
}
```

**Required fields:**

- `name` - Exporter identifier (lowercase, alphanumeric, hyphens)
- `version` - Semver version string
- `outputPaths` - Array of file paths this exporter creates
- `handlerPath` - Relative path to TypeScript handler (or `null` for declarative-only)

**Optional fields:**

- `description` - Human-readable description
- `author` - Your name and email
- `schema` - JSON Schema for exporter-specific config

### 2. Implement handler

Create `packages/exporters/src/<agent-name>/index.ts`:

```typescript
import { ExporterPlugin, ScopedExportRequest, ExportResult } from "@aligntrue/plugin-contracts";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { createHash } from "crypto";

export class MyAgentExporter implements ExporterPlugin {
  name = "my-agent";
  version = "1.0.0";

  async export(request: ScopedExportRequest): Promise<ExportResult> {
    const { scope, rules, dryRun } = request;

    // Generate output content
    const content = this.formatRules(rules);

    // Compute content hash
    const hash = createHash("sha256").update(content).digest("hex");

    // Write file (if not dry-run)
    const outputPath = ".myagent/rules.md";
    if (!dryRun) {
      const writer = new AtomicFileWriter();
      await writer.writeFile(outputPath, content);
    }

    return {
      filesWritten: dryRun ? [] : [outputPath],
      warnings: [],
      fidelityNotes: this.computeFidelityNotes(rules),
      metadata: {
        scope: scope.name,
        ruleCount: rules.length,
        contentHash: hash,
      },
    };
  }

  private formatRules(rules: AlignRule[]): string {
    // Convert rules to agent format
    let output = "# My Agent Rules\n\n";

    for (const rule of rules) {
      output += `## ${rule.summary}\n\n`;
      output += `**Severity:** ${rule.severity}\n\n`;
      if (rule.guidance) {
        output += `${rule.guidance}\n\n`;
      }
    }

    return output;
  }

  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];

    // Check for unsupported fields
    for (const rule of rules) {
      if (rule.check) {
        notes.push(`Rule '${rule.id}': machine checks not supported`);
      }
      if (rule.autofix) {
        notes.push(`Rule '${rule.id}': autofix not supported`);
      }
    }

    return notes;
  }
}

// Export factory function
export default function createExporter(): ExporterPlugin {
  return new MyAgentExporter();
}
```

**Key interfaces:**

- `ExporterPlugin` - Main interface all exporters implement
- `ScopedExportRequest` - Input containing scope, rules, config
- `ExportResult` - Output with files written, warnings, fidelity notes

### 3. Add tests

Create `packages/exporters/tests/<agent-name>.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MyAgentExporter } from "../src/my-agent";
import { unlinkSync, existsSync } from "fs";

describe("MyAgentExporter", () => {
  const exporter = new MyAgentExporter();
  const outputPath = ".myagent/rules.md";

  afterEach(() => {
    if (existsSync(outputPath)) {
      unlinkSync(outputPath);
    }
  });

  it("exports single rule", async () => {
    const result = await exporter.export({
      scope: { name: "default", path: "." },
      rules: [
        {
          id: "test.rule",
          summary: "Test rule",
          severity: "error",
          guidance: "Do the thing",
        },
      ],
      config: {},
      dryRun: false,
    });

    expect(result.filesWritten).toEqual([outputPath]);
    expect(existsSync(outputPath)).toBe(true);
  });

  it("respects dry-run", async () => {
    const result = await exporter.export({
      scope: { name: "default", path: "." },
      rules: [{ id: "test.rule", summary: "Test", severity: "error" }],
      config: {},
      dryRun: true,
    });

    expect(result.filesWritten).toEqual([]);
    expect(existsSync(outputPath)).toBe(false);
  });

  it("reports fidelity notes for unsupported fields", async () => {
    const result = await exporter.export({
      scope: { name: "default", path: "." },
      rules: [
        {
          id: "test.rule",
          summary: "Test",
          severity: "error",
          check: { type: "file_presence", paths: ["README.md"] },
        },
      ],
      config: {},
      dryRun: true,
    });

    expect(result.fidelityNotes).toContain("Rule 'test.rule': machine checks not supported");
  });
});
```

**Test patterns:**

- Basic export (single rule, multiple rules)
- Dry-run mode (no files written)
- Fidelity tracking (unsupported fields)
- Vendor metadata extraction
- Snapshot tests for format validation

## Exporter patterns

### Pattern 1: Single file at root

Used by: `AGENTS.md`, `CLAUDE.md`, `CRUSH.md`

**Characteristics:**

- One file per workspace
- Merges all scopes into single file
- Universal format readable by multiple agents

**Example structure:**

```markdown
# AGENTS.md v1

## Rule: use-typescript-strict

**Severity:** ERROR

Use TypeScript strict mode in all files.

Enable strict mode in tsconfig.json.
```

**Implementation tips:**

- Accumulate rules across scope calls (use class state)
- Reset state between exports (provide `resetState()` method)
- Include version marker in header

**See:** `packages/exporters/src/agents-md/index.ts`

---

### Pattern 2: Directory-based

Used by: Cursor (`.cursor/rules/*.mdc`), AugmentCode (`.augment/rules/*.md`)

**Characteristics:**

- One file per scope (or merged)
- Files organized in dedicated directory
- Scope name determines filename

**Example structure:**

```
.cursor/rules/
  aligntrue.mdc        # Default scope
  apps-web.mdc         # apps/web scope
  packages-core.mdc    # packages/core scope
```

**Implementation tips:**

- Convert scope path to filename (`apps/web` → `apps-web.mdc`)
- Create directory if it doesn't exist
- Use atomic writes for safety

**See:** `packages/exporters/src/cursor/index.ts`

---

### Pattern 3: Config file

Used by: VS Code MCP (`.vscode/mcp.json`), Windsurf (`.windsurf/mcp_config.json`)

**Characteristics:**

- JSON or YAML configuration
- Single file at specific location
- May include non-rule metadata

**Example structure:**

```json
{
  "version": "1",
  "rules": [
    {
      "id": "use-typescript-strict",
      "summary": "Use TypeScript strict mode",
      "severity": "error"
    }
  ]
}
```

**Implementation tips:**

- Validate JSON structure before writing
- Pretty-print with 2-space indent
- Create parent directory if needed

**See:** `packages/exporters/src/vscode-mcp/index.ts`

---

### Pattern 4: Dual output

Used by: Agents requiring both rules + config (e.g., Cursor + MCP)

**Characteristics:**

- Returns multiple files in `filesWritten` array
- Rules file + config file
- Both outputs synchronized

**Example:**

```typescript
return {
  filesWritten: [".cursor/rules/aligntrue.mdc", ".cursor/mcp.json"],
  // ...
};
```

**See:** `packages/exporters/docs/DUAL_OUTPUT_CONFIGURATION.md`

## Vendor metadata

### Extracting agent-specific fields

Rules can include agent-specific metadata in `vendor.<agent>` namespace:

```yaml
id: my-project.backend.use-typescript
summary: Use TypeScript strict mode
severity: error
vendor:
  cursor:
    ai_hint: "Suggest TypeScript strict mode when creating new files"
  vscode:
    diagnostic_code: "TS001"
```

**Extract in your exporter:**

```typescript
private extractVendorMetadata(rule: AlignRule): Record<string, unknown> {
  return rule.vendor?.['my-agent'] || {};
}
```

### Vendor.volatile exclusion

Fields marked volatile are excluded from hashing:

```yaml
vendor:
  _meta:
    volatile: ["my-agent.cache", "my-agent.lastSeen"]
  my-agent:
    cache: "temporary data"
    lastSeen: "2025-01-01"
```

Don't rely on volatile fields for deterministic output.

## Fidelity tracking

### When to report fidelity notes

Report when you cannot fully represent a field:

```typescript
private computeFidelityNotes(rules: AlignRule[]): string[] {
  const notes: string[] = [];

  for (const rule of rules) {
    // Unsupported fields
    if (rule.check) {
      notes.push(`Rule '${rule.id}': machine checks not supported`);
    }

    // Cross-agent vendor metadata
    const otherVendors = Object.keys(rule.vendor || {})
      .filter(k => k !== 'my-agent' && k !== '_meta');
    if (otherVendors.length > 0) {
      notes.push(`Rule '${rule.id}': vendor metadata for ${otherVendors.join(', ')}`);
    }
  }

  return notes;
}
```

### Common fidelity issues

- **Machine checks** - `check` field not mappable
- **Autofix hints** - `autofix` field not supported
- **Vendor metadata** - Other agent metadata preserved but not used
- **Severity mapping** - Agent uses different severity levels

## Testing requirements

### Minimum test coverage

1. **Basic export** - Single rule, multiple rules
2. **Dry-run mode** - No files written when `dryRun: true`
3. **Vendor extraction** - Agent-specific metadata extracted correctly
4. **Fidelity tracking** - Unsupported fields reported in notes
5. **Format validation** - Output matches expected format (snapshot tests)

### Snapshot tests

Use Vitest snapshots to validate output format:

```typescript
it("generates expected format", async () => {
  const result = await exporter.export({
    scope: { name: "default", path: "." },
    rules: [fixture.singleRule],
    config: {},
    dryRun: true,
  });

  const content = await fs.readFile(outputPath, "utf-8");
  expect(content).toMatchSnapshot();
});
```

First run generates snapshot, subsequent runs validate against it.

### Test fixtures

Create reusable fixtures in `tests/fixtures/<agent-name>/`:

```typescript
// tests/fixtures/my-agent/single-rule.yaml
export const singleRule: AlignRule = {
  id: "test.single-rule",
  summary: "Test rule",
  severity: "error",
  guidance: "Do the thing",
};
```

## Contribution process

### 1. Check existing exporters

Before creating a new exporter, check if your agent can use:

- `agents-md` - Universal AGENTS.md format (11+ agents)
- `root-mcp` - MCP config at root (Claude Code, Aider)

### 2. Follow technical guide

See `packages/exporters/CONTRIBUTING.md` for:

- Directory structure
- TypeScript configuration
- Build and test commands
- PR requirements

### 3. Submit pull request

**PR checklist:**

- [ ] Manifest validates against schema
- [ ] Handler implements `ExporterPlugin` interface
- [ ] 5+ tests covering basic scenarios
- [ ] Snapshot tests for format validation
- [ ] README updated (if needed)
- [ ] Example output in PR description

### 4. Maintenance

Once merged, you'll be listed as the maintainer for that exporter. We'll ping you for:

- Agent format changes
- Bug reports specific to your exporter
- Feature requests from users

## References

### Example exporters

**Simple (good starting points):**

- `packages/exporters/src/agents-md/` - Single file, universal format
- `packages/exporters/src/cline/` - Plain text, no metadata

**Medium complexity:**

- `packages/exporters/src/cursor/` - Directory-based, YAML frontmatter
- `packages/exporters/src/vscode-mcp/` - JSON config, vendor extraction

**Advanced:**

- `packages/exporters/src/cursor/` + MCP - Dual output pattern

### Documentation

- [Command Reference](/reference/cli-reference) - CLI usage
- [Import Workflow](/reference/import-workflow) - Migrate from existing agent rules
- [Sync Behavior](/concepts/sync-behavior) - How exports are triggered
- [Technical CONTRIBUTING.md](https://github.com/AlignTrue/aligntrue/blob/main/packages/exporters/CONTRIBUTING.md) - Detailed requirements

### Community

- GitHub Discussions: [github.com/AlignTrue/aligntrue/discussions](https://github.com/AlignTrue/aligntrue/discussions)
- Issues: [github.com/AlignTrue/aligntrue/issues](https://github.com/AlignTrue/aligntrue/issues)

---

**Questions?** Open a discussion on GitHub. We're happy to help new contributors!
