# Contributing Adapters to AlignTrue

Thank you for contributing to AlignTrue! This guide covers how to create and submit new exporter adapters.

## Requirements

All adapter contributions must meet these requirements:

### 1. License

- **MIT License** required for all contributions
- Add `"license": "MIT"` to your `manifest.json`
- Include license header in source files

### 2. Snapshot Tests

- **Required:** Snapshot tests with golden outputs
- Minimum 80% code coverage
- Test all export scenarios (happy path + errors)
- Include tests for fidelity notes

### 3. Semantic Versioning

- Follow [Semantic Versioning 2.0.0](https://semver.org/)
- Start at `1.0.0` for initial release
- Increment patch for bug fixes
- Increment minor for backward-compatible features
- Increment major for breaking changes

### 4. Documentation

- Update README.md with adapter description
- Document any fidelity limitations
- Provide usage examples
- Include troubleshooting section if needed

## Adapter Structure

```
packages/exporters/src/my-adapter/
├── manifest.json          # Required: adapter metadata
├── index.ts               # Required: ExporterPlugin implementation
├── templates/             # Optional: output templates
└── tests/
    ├── exporter.test.ts   # Required: unit tests
    └── snapshots/         # Required: golden outputs
        └── export.test.ts.snap
```

## Step-by-Step Guide

### 1. Create Manifest

Create `manifest.json` with required fields:

```json
{
  "name": "my-adapter",
  "version": "1.0.0",
  "description": "Export AlignTrue rules to My Tool format",
  "outputs": [".mytool/*.txt"],
  "handler": "./index.ts",
  "license": "MIT",
  "fidelityNotes": ["List any semantic mapping limitations here"]
}
```

**Validation rules:**

- `name` must match pattern `^[a-z0-9-]+$` (lowercase alphanumeric with hyphens)
- `version` must be valid semver `^\\d+\\.\\d+\\.\\d+$`
- `description` minimum 10 characters
- `outputs` minimum 1 item

### 2. Implement ExporterPlugin

Create `index.ts`:

```typescript
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

export class MyAdapterExporter implements ExporterPlugin {
  name = "my-adapter";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules, outputPath } = request;
    const { outputDir, dryRun, backup } = options;

    // Generate output content
    const content = this.generateOutput(rules, scope);

    // Compute content hash
    const contentHash = this.computeHash(content);

    // Write file (unless dry-run)
    const filesWritten: string[] = [];
    if (!dryRun) {
      const fullPath = join(outputDir, outputPath);
      mkdirSync(dirname(fullPath), { recursive: true });

      if (backup) {
        // Backup logic if needed
      }

      writeFileSync(fullPath, content, "utf-8");
      filesWritten.push(fullPath);
    }

    // Collect fidelity notes
    const fidelityNotes = this.getFidelityNotes(rules);

    return {
      success: true,
      filesWritten,
      contentHash,
      fidelityNotes,
    };
  }

  private generateOutput(rules: AlignRule[], scope: ResolvedScope): string {
    // Your output generation logic
    return rules
      .map((rule) => {
        return `# ${rule.id}\n${rule.guidance || ""}`;
      })
      .join("\n\n");
  }

  private computeHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private getFidelityNotes(rules: AlignRule[]): string[] {
    // Check for features not supported by target format
    const notes: string[] = [];

    // Example: check if severity levels are used
    const hasSeverity = rules.some((r) => r.severity && r.severity !== "warn");
    if (hasSeverity) {
      notes.push("Severity levels mapped to comments (not enforced)");
    }

    return notes;
  }
}

// Export as default for registry loading
export default MyAdapterExporter;
```

### 3. Write Tests

Create comprehensive tests with snapshots:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MyAdapterExporter } from "./index.js";
import type { ScopedExportRequest, ExportOptions } from "../types.js";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("MyAdapterExporter", () => {
  const tempDir = join(__dirname, "temp");
  let exporter: MyAdapterExporter;

  beforeEach(() => {
    exporter = new MyAdapterExporter();

    // Clean and create temp directory
    try {
      rmSync(tempDir, { recursive: true });
    } catch {}
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true });
    } catch {}
  });

  it("has correct name and version", () => {
    expect(exporter.name).toBe("my-adapter");
    expect(exporter.version).toBe("1.0.0");
  });

  it("exports rules successfully", async () => {
    const request: ScopedExportRequest = {
      scope: {
        path: ".",
        normalizedPath: ".",
        isDefault: true,
      },
      rules: [
        {
          id: "test-rule",
          severity: "warn",
          applies_to: ["**/*.ts"],
          guidance: "Test guidance",
        },
      ],
      outputPath: ".mytool/rules.txt",
    };

    const options: ExportOptions = {
      outputDir: tempDir,
      dryRun: false,
    };

    const result = await exporter.export(request, options);

    expect(result.success).toBe(true);
    expect(result.filesWritten).toHaveLength(1);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("respects dry-run mode", async () => {
    const result = await exporter.export(request, { ...options, dryRun: true });

    expect(result.success).toBe(true);
    expect(result.filesWritten).toHaveLength(0);
  });

  it("matches snapshot for standard rules", async () => {
    const output = await exporter.export(request, options);
    const content = readFileSync(output.filesWritten[0], "utf-8");

    expect(content).toMatchSnapshot();
  });

  it("includes fidelity notes when applicable", async () => {
    const request: ScopedExportRequest = {
      scope: { path: ".", normalizedPath: ".", isDefault: true },
      rules: [
        {
          id: "test-rule",
          severity: "error", // Non-default severity
          applies_to: ["**/*.ts"],
          guidance: "Test",
        },
      ],
      outputPath: ".mytool/rules.txt",
    };

    const result = await exporter.export(request, options);

    expect(result.fidelityNotes).toBeDefined();
    expect(result.fidelityNotes?.length).toBeGreaterThan(0);
  });
});
```

### 4. Validate Manifest

Run validation:

```bash
cd packages/exporters
pnpm test tests/manifest-schema.test.ts
```

### 5. Run Tests

Ensure all tests pass:

```bash
pnpm test
```

## Testing Guidelines

### Snapshot Tests

**Required:** Golden output tests that verify byte-identical exports

```typescript
it("matches snapshot", async () => {
  const output = await exporter.export(request, options);
  const content = readFileSync(output.filesWritten[0], "utf-8");
  expect(content).toMatchSnapshot();
});
```

**Update snapshots:**

```bash
pnpm test -- -u
```

### Coverage Requirements

- Minimum 80% code coverage
- Test all public methods
- Test error paths
- Test edge cases (empty rules, special characters, etc.)

### Test Scenarios

1. **Happy path** - Standard export with typical rules
2. **Empty rules** - Handle zero rules gracefully
3. **Complex rules** - Test all IR fields (severity, applies_to, tags, vendor)
4. **Dry-run mode** - Verify no files written
5. **Backup mode** - Verify backup files created
6. **Fidelity notes** - Test all documented limitations
7. **Error handling** - Invalid input, filesystem errors

## Pull Request Checklist

Before submitting your PR:

- [ ] Manifest validates against schema
- [ ] ExporterPlugin interface implemented correctly
- [ ] All tests pass (46+ tests across all adapters)
- [ ] Snapshot tests included
- [ ] Code coverage ≥80%
- [ ] README.md updated with adapter description
- [ ] CONTRIBUTING.md reviewed
- [ ] License is MIT
- [ ] No TypeScript errors
- [ ] Fidelity notes documented
- [ ] Examples provided

## Code Review Process

1. **Automated checks** - CI runs tests and validates manifest
2. **Manual review** - Maintainers review code quality and tests
3. **Feedback** - Address review comments
4. **Merge** - Once approved, PR is merged to main

## Versioning Policy

**Pre-1.0 (Current)**

- Schema may change without migration framework
- Breaking changes allowed with notice
- Adapters should be flexible

**Post-1.0**

- Schema locked for breaking changes
- Migration framework required
- Semver strictly enforced

## Questions?

- Open an issue: https://github.com/AlignTrue/aligntrue/issues
- Discussions: https://github.com/AlignTrue/aligntrue/discussions

## License

By contributing, you agree to license your work under the MIT License.
