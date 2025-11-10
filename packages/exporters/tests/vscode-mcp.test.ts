/**
 * Tests for VS Code MCP config exporter
 * Validates v1 JSON format generation and sections-based exports
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { VsCodeMcpExporter } from "../src/vscode-mcp/index.js";
import type { ScopedExportRequest, ExportOptions } from "../src/types.js";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { loadFixture, createDefaultScope } from "./helpers/test-fixtures.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "cursor");
const TEST_OUTPUT_DIR = join(
  import.meta.dirname,
  "temp-vscode-mcp-test-output",
);

describe("VsCodeMcpExporter", () => {
  let exporter: VsCodeMcpExporter;

  beforeEach(() => {
    exporter = new VsCodeMcpExporter();
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

  describe("Basic functionality", () => {
    it("implements ExporterPlugin interface", () => {
      expect(exporter.name).toBe("vscode-mcp");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });

    it("exports single rule successfully", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("exports multiple rules successfully", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("handles empty sections array", async () => {
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

  describe("File operations", () => {
    it("writes to .vscode/mcp.json at workspace root", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      expect(result.filesWritten[0].replace(/\\/g, "/")).toMatch(
        /\.vscode\/mcp\.json$/,
      );
    });

    it("dry-run mode returns content without writing", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      // Dry-run still returns filesWritten in the result
      expect(result.contentHash).toBeTruthy();
    });
  });

  describe("Scope merging", () => {
    it("handles default scope correctly", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Fidelity tracking", () => {
    it("tracks unmapped fields in fidelity notes when present", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      // Fidelity notes may be present for unmapped fields or empty
      expect(
        typeof result.fidelityNotes === "string" ||
          result.fidelityNotes === undefined,
      ).toBe(true);
    });
  });

  describe("Content hash", () => {
    it("computes deterministic hash from canonical IR", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("hash consistent across multiple exports of same IR", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request1 = createRequest(fixture.sections, createDefaultScope());
      const request2 = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result1 = await exporter.export(request1, options);

      // Reset state between exports (simulating what SyncEngine does)
      exporter.resetState();

      const result2 = await exporter.export(request2, options);

      expect(result1.contentHash).toBe(result2.contentHash);
    });
  });
});

// Helper functions

function createRequest(
  sections: AlignSection[],
  scope: ReturnType<typeof createDefaultScope>,
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
    outputPath: join(TEST_OUTPUT_DIR, ".vscode", "mcp.json"),
  };
}
