# Extending AlignTrue

Guide for contributing new exporters and extending AlignTrue to support additional AI coding agents.

## Overview

AlignTrue supports 50+ AI coding agents through a manifest + handler system. Adding support for a new agent typically takes 1-2 hours and requires:

1. A JSON manifest describing the exporter (validated against our schema)
2. (Optional) A TypeScript handler for custom export logic
3. Tests validating output format, fidelity notes, and dry-run behavior

### When to create a new exporter

**Create a new exporter when:**

- The agent uses a unique file format (e.g., `.cursor/*.mdc`, `.clinerules`)
- The agent requires specific metadata or configuration
- The agent has special formatting requirements

**Use an existing exporter when:**

- The agent reads `AGENTS.md` (works for 11+ agents)
- The agent follows a standard config format you can adapt

### Exporter types

AlignTrue supports four main patterns:

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
  "outputs": [".myagent/rules.md"],
  "handler": "./index.js",
  "license": "MIT",
  "supportedFormats": ["native"],
  "defaultFormat": "native",
  "fidelityNotes": [
    "Describe any semantic gaps between AlignTrue IR and My Agent"
  ]
}
```

**Required fields (validated by `packages/exporters/schema/manifest.schema.json`):**

- `name` - Exporter identifier (lowercase, alphanumeric, hyphens)
- `version` - Semver version string
- `description` - Human-readable description (min 10 characters)
- `outputs` - Array of file paths/patterns this exporter creates

**Common optional fields:**

- `handler` - Relative path to TypeScript handler (omit for declarative-only exporters)
- `license` - Defaults to `MIT` (required for contributions)
- `supportedFormats` / `defaultFormat` - Use when the exporter can emit multiple formats (e.g., `native`, `agents-md`)
- `fidelityNotes` - Known semantic gaps to surface in CLI output

### 2. Implement handler

Create `packages/exporters/src/<agent-name>/index.ts`:

```typescript
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import type { AlignSection, RuleFrontmatter } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";
import { join } from "node:path";

export class MyAgentExporter extends ExporterBase {
  name = "my-agent";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;
    const sections = request.align.sections ?? [];

    // Render content for the agent
    const content = this.renderContent(sections);
    const contentHash = this.computeHash({ sections });

    // Respect CLI outputDir, allow interactive/force flags to flow through
    const outputPath = join(outputDir, ".myagent/rules.md");
    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options,
    );

    // Surface any partial fidelity (e.g., unsupported metadata)
    const fidelityNotes = this.computeSectionFidelityNotes(sections);

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  override translateFrontmatter(frontmatter: RuleFrontmatter) {
    // Optional: map AlignTrue frontmatter to agent-specific metadata
    return { ...frontmatter };
  }

  private renderContent(sections: AlignSection[]): string {
    // For many exporters, natural markdown is enough; customize as needed
    return super.renderSections(sections);
  }
}

export default function createExporter() {
  return new MyAgentExporter();
}
```

**Key interfaces:**

- `ExporterPlugin` (`@aligntrue/plugin-contracts`) - contract exporters implement
- `ScopedExportRequest` - provides `scope`, `align.sections`, and suggested `outputPath`
- `ExportOptions` - includes `outputDir`, `dryRun`, `interactive`, `force`, `contentMode`
- `ExporterBase` helpers - `writeFile`, `computeHash`, `computeSectionFidelityNotes`, `renderSectionsAsMarkdown`, optional `translateFrontmatter`, `resetState`

### 3. Add tests

Create `packages/exporters/tests/<agent-name>.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, readFileSync, existsSync } from "node:fs";
import { MyAgentExporter } from "../src/my-agent/index.js";

const defaultScope = { path: ".", normalizedPath: ".", isDefault: true };

describe("MyAgentExporter", () => {
  const exporter = new MyAgentExporter();
  let outputDir: string;
  const outputPath = ".myagent/rules.md";

  beforeEach(() => {
    outputDir = join(
      tmpdir(),
      `my-agent-${Math.random().toString(16).slice(2)}`,
    );
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("exports a section", async () => {
    const result = await exporter.export(
      {
        scope: defaultScope,
        align: {
          sections: [
            {
              heading: "Test rule",
              content: "Do the thing",
              fingerprint: "test-rule",
            },
          ],
        },
        outputPath,
      },
      { outputDir, dryRun: false },
    );

    expect(result.filesWritten).toEqual([join(outputDir, outputPath)]);
    expect(readFileSync(join(outputDir, outputPath), "utf-8")).toContain(
      "Test rule",
    );
  });

  it("respects dry-run", async () => {
    const result = await exporter.export(
      {
        scope: defaultScope,
        align: {
          sections: [
            { heading: "Dry run", content: "noop", fingerprint: "dry" },
          ],
        },
        outputPath,
      },
      { outputDir, dryRun: true },
    );

    expect(result.filesWritten).toEqual([]);
    expect(existsSync(join(outputDir, outputPath))).toBe(false);
  });

  it("reports fidelity notes for unsupported metadata", async () => {
    const result = await exporter.export(
      {
        scope: defaultScope,
        align: {
          sections: [
            {
              heading: "With vendor data",
              content: "Ensure README.md exists in the project root.",
              fingerprint: "vendor",
              vendor: { cursor: { ai_hint: "unused here" } },
            },
          ],
        },
        outputPath,
      },
      { outputDir, dryRun: true },
    );

    expect(result.fidelityNotes).toBeDefined();
  });
});
```

**Test patterns:**

- Basic export (single section, multi-section, nested scopes)
- Dry-run mode (no files written when `dryRun: true`)
- Fidelity tracking (unsupported metadata noted)
- Vendor metadata extraction (e.g., `vendor.<agent>` passthroughs)
- Snapshot tests for format validation using the actual file output

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

**See:** `packages/exporters/src/agents/index.ts`

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
  rule1.mdc            # Default scope, rule 1
  rule2.mdc            # Default scope, rule 2
  apps-web-rule1.mdc   # apps/web scope, rule 1
  packages-core-rule1.mdc  # packages/core scope, rule 1
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
  filesWritten: [
    ".cursor/rules/rule1.mdc",
    ".cursor/rules/rule2.mdc",
    ".cursor/mcp.json",
  ],
  // ...
};
```

Multiple files in `filesWritten` are automatically synchronized when both are written in the same export operation.

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
private extractVendorMetadata(section: AlignSection): Record<string, unknown> {
  return section.vendor?.['my-agent'] || {};
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
private computeFidelityNotes(sections: AlignSection[]): string[] {
  const notes: string[] = [];

  for (const section of sections) {
    // Unsupported fields
    if ((section as Record<string, unknown>).check) {
      notes.push(`Section '${section.heading}': machine checks not supported`);
    }

    // Cross-agent vendor metadata
    const vendor = section.vendor || {};
    const otherVendors = Object.keys(vendor)
      .filter(k => k !== "my-agent" && k !== "_meta");
    if (otherVendors.length > 0) {
      notes.push(
        `Section '${section.heading}': vendor metadata for ${otherVendors.join(", ")}`,
      );
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

1. **Basic export** - Single section, multiple sections, nested scopes
2. **Dry-run mode** - No files written when `dryRun: true`
3. **Vendor extraction** - Agent-specific metadata extracted correctly
4. **Fidelity tracking** - Unsupported fields reported in notes
5. **Format validation** - Output matches expected format (snapshot tests)

### Snapshot tests

Use Vitest snapshots to validate output format using the real file on disk:

```typescript
it("generates expected format", async () => {
  await exporter.export(request, { outputDir, dryRun: false });
  const content = readFileSync(join(outputDir, outputPath), "utf-8");
  expect(content).toMatchSnapshot();
});
```

First run generates snapshot, subsequent runs validate against it.

### Test fixtures

Create reusable fixtures in `tests/fixtures/<agent-name>/` using Align sections:

```typescript
export const singleSection = {
  heading: "Test rule",
  content: "Do the thing",
  fingerprint: "test-rule",
};
```

## Contribution process

### 1. Check existing exporters

Before creating a new exporter, check if your agent can use:

- `agents` - Universal AGENTS.md format (11+ agents)
- `root-mcp` - MCP config at root (Claude Code, Aider)

### 2. Follow technical guide

See `packages/exporters/CONTRIBUTING.md` for:

- Directory structure
- TypeScript configuration
- Build and test commands
- PR requirements

### 3. Submit pull request

**PR checklist:**

- [ ] Manifest validates against `packages/exporters/schema/manifest.schema.json` and matches exporter name/version
- [ ] Handler implements `ExporterPlugin` interface (or declarative manifest if no handler)
- [ ] Tests cover basic export, dry-run, fidelity notes, vendor metadata, snapshots
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

- `packages/exporters/src/agents/` - Single file, universal format
- `packages/exporters/src/cline/` - Plain text, no metadata

**Medium complexity:**

- `packages/exporters/src/cursor/` - Directory-based, YAML frontmatter
- `packages/exporters/src/vscode-mcp/` - JSON config, vendor extraction

**Advanced:**

- `packages/exporters/src/cursor/` + MCP - Dual output pattern

### Documentation

- [Command Reference](/docs/04-reference/cli-reference) - CLI usage
- [Quickstart](/docs/00-getting-started/00-quickstart) - Get started with AlignTrue
- [Sync Behavior](/docs/03-concepts/sync-behavior) - How exports are triggered
- [Schema validation](https://github.com/AlignTrue/aligntrue/tree/main/packages/schema) - IR validation and type definitions
- [Exporter manifest schema](https://github.com/AlignTrue/aligntrue/blob/main/packages/exporters/schema/manifest.schema.json) - Required fields and validation
- [Plugin contracts](https://github.com/AlignTrue/aligntrue/blob/main/packages/plugin-contracts/src/exporter.ts) - Exporter interfaces and options
- [Technical CONTRIBUTING.md](https://github.com/AlignTrue/aligntrue/blob/main/packages/exporters/CONTRIBUTING.md) - Detailed requirements

### Community

- GitHub Discussions: [github.com/AlignTrue/aligntrue/discussions](https://github.com/AlignTrue/aligntrue/discussions)
- Issues: [github.com/AlignTrue/aligntrue/issues](https://github.com/AlignTrue/aligntrue/issues)

---

**Questions?** Open a discussion on GitHub. We're happy to help new contributors!
