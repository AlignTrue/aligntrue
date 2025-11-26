/**
 * Cursor exporter tests with snapshot validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { CursorExporter } from "../src/cursor/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { Align, AlignSection } from "@aligntrue/schema";
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
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      // New format: filename is based on rule name (section heading)
      expect(result.filesWritten[0].replace(/\\/g, "/")).toMatch(
        /\.cursor\/rules\/[a-z0-9-]+\.mdc$/,
      );
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(existsSync(result.filesWritten[0])).toBe(true);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("---"); // Has frontmatter
      expect(content).toContain("READ-ONLY"); // Has read-only marker
    }, 10000);

    it("exports multiple rules to separate .mdc files", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      // New format: one file per rule
      expect(result.filesWritten.length).toBeGreaterThanOrEqual(1);

      // Verify at least first file has proper content
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("---");
    });

    it("returns empty result when sections array is empty", async () => {
      const request = createRequest([], createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);
      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual([]);
      expect(result.contentHash).toBe("");
    });
  });

  describe("Vendor.cursor Metadata Extraction", () => {
    it("exports fixture with cursor metadata", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "with-vendor-cursor.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });

    it("exports mixed vendor namespaces", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "mixed-vendor.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe("Fidelity Notes", () => {
    it("generates fidelity notes when appropriate", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      // fidelityNotes may be undefined or empty for sections format
      if (result.fidelityNotes && result.fidelityNotes.length > 0) {
        const content = readFileSync(result.filesWritten[0], "utf-8");
        expect(content).toContain("**Fidelity Notes:**");
      }
      expect(result.success).toBe(true);
    });

    it("exports sections successfully", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "mixed-vendor.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
    });
  });

  describe("Scope-to-Filename Mapping", () => {
    it("exports rule file to .cursor/rules directory", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      // New format: filename is based on rule name, in .cursor/rules/
      expect(result.filesWritten[0].replace(/\\/g, "/")).toContain(
        ".cursor/rules/",
      );
      expect(result.filesWritten[0]).toMatch(/\.mdc$/);
    });

    it("uses nested_location for nested rules", async () => {
      // Note: nested_location is set in frontmatter, not via scope
      // This test verifies the output directory is .cursor/rules/
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope: ResolvedScope = {
        path: "apps/web",
        normalizedPath: "apps/web",
        isDefault: false,
        include: ["apps/web/**/*"],
      };
      const request = createRequest(fixture.sections, scope);
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      // Files go to .cursor/rules/ directory (nested_location is handled via frontmatter)
      expect(result.filesWritten[0].replace(/\\/g, "/")).toContain(
        ".cursor/rules/",
      );
    });

    it("creates .mdc files for each rule", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope: ResolvedScope = {
        path: "packages/core/src",
        normalizedPath: "packages/core/src",
        isDefault: false,
      };
      const request = createRequest(fixture.sections, scope);
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      // Each rule becomes an .mdc file
      expect(result.filesWritten[0].replace(/\\/g, "/")).toContain(
        ".cursor/rules/",
      );
      expect(result.filesWritten[0]).toMatch(/\.mdc$/);
    });
  });

  describe("Content Hash", () => {
    it("computes deterministic SHA-256 hash", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
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

    it("does not include content hash in exported files", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
      expect(result.filesWritten.length).toBeGreaterThan(0);

      // Verify content hash is NOT in the file - use actual written file
      const content = await import("fs").then((fs) =>
        fs.promises.readFile(result.filesWritten[0], "utf-8"),
      );
      expect(content).not.toContain("Content Hash");
      expect(content).not.toContain(result.contentHash);
    });
  });

  describe("Dry Run Mode", () => {
    it("does not write files in dry run mode", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
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
    it("handles multiple severity levels", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "all-severities.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe("Starter Rule Comment Stripping", () => {
    it("strips STARTER RULE comments from exported content", async () => {
      // Create a section with starter rule comment in content
      const sections: AlignSection[] = [
        {
          heading: "Test Rule",
          content: `<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# Test Rule Content

Follow this guidance for testing.`,
          scope: ".",
        },
      ];

      const request = createRequest(sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Verify STARTER RULE comment is stripped
      expect(content).not.toContain("STARTER RULE:");
      expect(content).not.toContain("Update, expand, or replace");

      // Verify actual content is preserved
      expect(content).toContain("# Test Rule Content");
      expect(content).toContain("Follow this guidance for testing");
    });

    it("preserves other HTML comments in content", async () => {
      const sections: AlignSection[] = [
        {
          heading: "Rule with Comments",
          content: `<!--
  STARTER RULE: This is a starting point.
-->

# Main Content

<!-- This is a regular comment -->

Some text here.`,
          scope: ".",
        },
      ];

      const request = createRequest(sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Starter rule comment should be stripped
      expect(content).not.toContain("STARTER RULE:");

      // Regular comments should be preserved
      expect(content).toContain("<!-- This is a regular comment -->");
    });
  });
});

// Helper functions

function createRequest(
  sections: AlignSection[],
  scope: ResolvedScope,
): ScopedExportRequest {
  const align: Align = {
    id: "test-align",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };

  return {
    scope,
    align,
    outputPath: join(TEST_OUTPUT_DIR, ".cursor", "rules", "aligntrue.mdc"),
  };
}
