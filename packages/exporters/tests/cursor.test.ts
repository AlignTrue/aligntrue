/**
 * Cursor exporter tests with snapshot validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { CursorExporter, generateMdcFooter } from "../src/cursor/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { AlignRule } from "@aligntrue/schema";
import { loadFixture, createDefaultScope } from "./helpers/test-fixtures.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "cursor");
const TEST_OUTPUT_DIR = join(import.meta.dirname, "temp-cursor-test-output");

describe("CursorExporter", () => {
  let exporter: CursorExporter;

  beforeEach(() => {
    exporter = new CursorExporter();
    // Clean up test output directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test output directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("Plugin Interface", () => {
    it("implements ExporterPlugin interface", () => {
      expect(exporter.name).toBe("cursor");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });
  });

  describe("Basic Export", () => {
    it("exports single rule to .mdc file", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      // Normalize path separators for cross-platform compatibility
      expect(result.filesWritten[0].replace(/\\/g, "/")).toMatch(
        /\.cursor\/rules\/aligntrue\.mdc$/,
      );
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(existsSync(result.filesWritten[0])).toBe(true);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toMatchSnapshot();
    });

    it("exports multiple rules to single .mdc file", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("## Rule: testing.require-tests");
      expect(content).toContain("## Rule: docs.update-readme");
      expect(content).toContain("## Rule: style.use-prettier");
      expect(content).toMatchSnapshot();
    });

    it("throws error when rules array is empty", async () => {
      const request = createRequest([], createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      await expect(exporter.export(request, options)).rejects.toThrow(
        "CursorExporter requires at least one rule to export",
      );
    });
  });

  describe("Vendor.cursor Metadata Extraction", () => {
    it("extracts vendor.cursor fields to frontmatter", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "with-vendor-cursor.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("cursor:");
      expect(content).toContain("testing.require-tests:");
      expect(content).toContain(
        'ai_hint: "Suggest test scaffolding with vitest"',
      );
      expect(content).toMatchSnapshot();
    });

    it("handles mixed vendor namespaces", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "mixed-vendor.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      // Should extract cursor metadata
      expect(content).toContain("cursor:");
      expect(content).toContain('ai_hint: "Suggest vitest"');
      // Should include fidelity note about other agents
      expect(content).toContain(
        "Vendor metadata for other agents preserved but not active: copilot, vscode",
      );
      expect(content).toMatchSnapshot();
    });
  });

  describe("Fidelity Notes", () => {
    it("includes fidelity notes in footer", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.fidelityNotes).toBeDefined();
      expect(result.fidelityNotes!.length).toBeGreaterThan(0);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("**Fidelity Notes:**");
      expect(content).toContain(
        "applies_to patterns preserved in metadata but not enforced by Cursor",
      );
    });

    it("tracks cross-agent vendor fields", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "mixed-vendor.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      const note = result.fidelityNotes!.find((n) =>
        n.includes("other agents"),
      );
      expect(note).toContain("copilot");
      expect(note).toContain("vscode");
    });
  });

  describe("Scope-to-Filename Mapping", () => {
    it("maps default scope to aligntrue.mdc", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.filesWritten[0]).toContain("aligntrue.mdc");
    });

    it("maps named scope to scoped filename", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope: ResolvedScope = {
        path: "apps/web",
        normalizedPath: "apps/web",
        isDefault: false,
        include: ["apps/web/**/*"],
      };
      const request = createRequest(fixture.rules, scope);
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.filesWritten[0]).toContain("apps-web.mdc");
    });

    it("normalizes paths with slashes to hyphens", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope: ResolvedScope = {
        path: "packages/core/src",
        normalizedPath: "packages/core/src",
        isDefault: false,
      };
      const request = createRequest(fixture.rules, scope);
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.filesWritten[0]).toContain("packages-core-src.mdc");
    });
  });

  describe("Content Hash", () => {
    it("computes deterministic SHA-256 hash", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result1 = await exporter.export(request, options);

      // Clean up and export again
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
      mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

      const result2 = await exporter.export(request, options);

      expect(result1.contentHash).toBe(result2.contentHash);
      expect(result1.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("includes content hash in footer", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("Content Hash:");
      expect(content).toContain(result.contentHash);
    });
  });

  describe("Dry Run Mode", () => {
    it("does not write files in dry run mode", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(0);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(
        existsSync(join(TEST_OUTPUT_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(false);
    });
  });

  describe("All Severities", () => {
    it("handles error, warn, and info severities", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "all-severities.yaml");
      const request = createRequest(fixture.rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("**Severity:** error");
      expect(content).toContain("**Severity:** warn");
      expect(content).toContain("**Severity:** info");
      expect(content).toMatchSnapshot();
    });
  });

  describe("Cursor Mode Preservation", () => {
    it('exports mode: "always" as alwaysApply', async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          mode: "always",
          guidance: "Test guidance",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("alwaysApply: true");
    });

    it('exports mode: "intelligent" with description', async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "warn",
          applies_to: ["**/*"],
          mode: "intelligent",
          description: "Intelligent mode active",
          guidance: "Smart rule",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("intelligent: true");
      expect(content).toContain("description: Intelligent mode active");
    });

    it('exports mode: "files" with applies_to as globs', async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "info",
          applies_to: ["src/**/*.ts", "tests/**/*.test.ts"],
          mode: "files",
          guidance: "Test guidance",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("globs:");
      expect(content).toContain('- "src/**/*.ts"');
      expect(content).toContain('- "tests/**/*.test.ts"');
    });

    it("exports title and tags when present", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          mode: "always",
          title: "Test Rule",
          tags: ["typescript", "quality"],
          guidance: "Test guidance",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("title: Test Rule");
      expect(content).toContain("tags:");
      expect(content).toContain("- typescript");
      expect(content).toContain("- quality");
    });

    it("restores unknown fields from vendor.cursor._unknown", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          mode: "always",
          guidance: "Test guidance",
          vendor: {
            cursor: {
              _unknown: {
                customField: "custom value",
                futureFeature: 42,
              },
            },
          },
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("customField: custom value");
      expect(content).toContain("futureFeature: 42");
    });

    it("separates schema fields and per-rule vendor metadata", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          mode: "intelligent",
          description: "File desc",
          guidance: "Test guidance",
          vendor: {
            cursor: {
              ai_hint: "Per-rule hint", // Per-rule only
              quick_fix: true, // Per-rule only
            },
          },
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      // Schema fields in frontmatter (intelligent mode exports description)
      expect(content).toContain("intelligent: true");
      expect(content).toContain("description: File desc");
      // Per-rule vendor fields under cursor: key
      expect(content).toContain("cursor:");
      expect(content).toContain("test.rule.id:");
      expect(content).toContain('ai_hint: "Per-rule hint"');
      expect(content).toContain("quick_fix: true");
    });

    it("exports intelligent mode WITH globs (globs filter where AI relevance applies)", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "warn",
          applies_to: ["src/**/*.ts", "lib/**/*.js"],
          mode: "intelligent",
          description: "Smart TypeScript/JS rule",
          guidance:
            "AI decides relevance, but only on TypeScript and JavaScript files",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      // Should have both intelligent mode AND globs
      expect(content).toContain("intelligent: true");
      expect(content).toContain("description: Smart TypeScript/JS rule");
      expect(content).toContain("globs:");
      expect(content).toContain('- "src/**/*.ts"');
      expect(content).toContain('- "lib/**/*.js"');
    });

    it("exports always mode WITH globs (globs filter which files get auto-applied)", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*.py", "**/*.pyi"],
          mode: "always",
          guidance: "Auto-apply only to Python files",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      // Should have both always mode AND globs
      expect(content).toContain("alwaysApply: true");
      expect(content).toContain("globs:");
      expect(content).toContain('- "**/*.py"');
      expect(content).toContain('- "**/*.pyi"');
    });

    it("does not export globs when applies_to is default **/*", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "warn",
          applies_to: ["**/*"], // Default - applies to all files
          mode: "intelligent",
          description: "Applies everywhere",
          guidance: "No globs needed",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("intelligent: true");
      expect(content).toContain("description: Applies everywhere");
      // Should NOT have globs since it's the default
      expect(content).not.toContain("globs:");
    });
  });

  describe("mode hints and round-trip invariants", () => {
    const options: ExportOptions = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: false,
    };

    it("should always use native mode regardless of config", async () => {
      const config = { export: { mode_hints: { default: "hints" } } };
      const request = createRequest(
        loadFixture(FIXTURES_DIR, "single-rule.yaml").rules,
        createDefaultScope(),
      );
      const result = await exporter.export(request, { ...options, config });
      const content = readFileSync(result.filesWritten[0], "utf-8");
      // Should NOT have HTML comment markers
      expect(content).not.toContain("<!-- aligntrue:begin");
      // Should have native frontmatter
      expect(content).toContain("---");
    });

    it("should preserve vendor.cursor.globs byte-identical", async () => {
      const rules = [createRuleWithVendorGlobs(["**/*.ts", "**/*.tsx"])];
      const request = createRequest(rules, createDefaultScope());
      const result = await exporter.export(request, options);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("globs:");
      expect(content).toContain('- "**/*.ts"');
      expect(content).toContain('- "**/*.tsx"');
    });

    it("should prefer vendor.cursor.globs over applies_to in frontmatter", async () => {
      const rule = {
        id: "test.rule.id",
        severity: "error" as const,
        applies_to: ["**/*.js"],
        mode: "always" as const,
        guidance: "Test rule",
        vendor: { cursor: { globs: ["**/*.ts"] } },
      };
      const request = createRequest([rule], createDefaultScope());
      const result = await exporter.export(request, options);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Extract frontmatter (between --- markers)
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch).toBeTruthy();
      const frontmatter = frontmatterMatch![1];

      // vendor.cursor.globs should be in frontmatter
      expect(frontmatter).toContain('- "**/*.ts"');
      // applies_to should NOT be in frontmatter
      expect(frontmatter).not.toContain("**/*.js");
    });

    it("should round-trip all execution modes correctly", async () => {
      const modes = ["always", "intelligent", "files", "manual"];
      for (const mode of modes) {
        const rule = { ...createBasicRule(), mode: mode as any };
        const request = createRequest([rule], createDefaultScope());
        const result = await exporter.export(request, options);
        const content = readFileSync(result.filesWritten[0], "utf-8");
        // Verify mode-specific frontmatter fields present
        if (mode === "always") expect(content).toContain("alwaysApply: true");
        if (mode === "intelligent")
          expect(content).toContain("intelligent: true");
        // etc.
      }
    });

    it("should work with mode_hints config present (ignored)", async () => {
      const config = {
        export: {
          mode_hints: {
            default: "metadata_only",
            overrides: { cursor: "hints" }, // Should be ignored
          },
        },
      };
      const request = createRequest(
        loadFixture(FIXTURES_DIR, "single-rule.yaml").rules,
        createDefaultScope(),
      );
      const result = await exporter.export(request, { ...options, config });
      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).not.toContain("aligntrue:begin");
    });
  });
});

describe("generateMdcFooter", () => {
  it("generates footer with content hash", () => {
    const hash = "abc123";
    const notes: string[] = [];

    const footer = generateMdcFooter(hash, notes);

    expect(footer).toContain("---");
    expect(footer).toContain("**Generated by AlignTrue**");
    expect(footer).toContain("Content Hash: abc123");
  });

  it("includes fidelity notes when provided", () => {
    const hash = "abc123";
    const notes = ["Note 1", "Note 2"];

    const footer = generateMdcFooter(hash, notes);

    expect(footer).toContain("**Fidelity Notes:**");
    expect(footer).toContain("- Note 1");
    expect(footer).toContain("- Note 2");
  });

  it("omits fidelity notes section when empty", () => {
    const hash = "abc123";
    const notes: string[] = [];

    const footer = generateMdcFooter(hash, notes);

    expect(footer).not.toContain("**Fidelity Notes:**");
  });
});

// Helper functions

function createRequest(
  rules: AlignRule[],
  scope: ResolvedScope,
): ScopedExportRequest {
  return {
    scope,
    rules,
    outputPath: join(TEST_OUTPUT_DIR, ".cursor", "rules", "aligntrue.mdc"),
  };
}

function createRuleWithVendorGlobs(globs: string[]): AlignRule {
  return {
    id: "test.rule.id",
    severity: "error",
    applies_to: ["**/*"],
    mode: "always",
    guidance: "Test rule with vendor globs",
    vendor: { cursor: { globs } },
  };
}

function createBasicRule(): AlignRule {
  return {
    id: "test.rule.id",
    severity: "error",
    applies_to: ["**/*"],
    mode: "always",
    guidance: "Basic test rule",
  };
}
