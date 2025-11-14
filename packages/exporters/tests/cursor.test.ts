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
import type { AlignPack, AlignSection } from "@aligntrue/schema";
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
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);

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
    it("maps default scope to aligntrue.mdc", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
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
      const request = createRequest(fixture.sections, scope);
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
      const request = createRequest(fixture.sections, scope);
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

    // DEPRECATED: Content hash footer test removed
    // Footers have been removed from exported files
    it.skip("includes content hash in footer", async () => {
      // This test is skipped because footers have been removed
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
});

// DEPRECATED: generateMdcFooter tests removed
// Footer generation has been removed from exports
describe.skip("generateMdcFooter", () => {
  it.skip("generates footer with content hash", () => {
    // This test is skipped because footers have been removed
  });

  it.skip("includes fidelity notes when provided", () => {
    // This test is skipped because footers have been removed
  });

  it.skip("omits fidelity notes section when empty", () => {
    // This test is skipped because footers have been removed
  });
});

// Helper functions

function createRequest(
  sections: AlignSection[],
  scope: ResolvedScope,
): ScopedExportRequest {
  const pack: AlignPack = {
    id: "test-pack",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };

  return {
    scope,
    pack,
    outputPath: join(TEST_OUTPUT_DIR, ".cursor", "rules", "aligntrue.mdc"),
  };
}
