/**
 * Kiro exporter tests with mode hints support
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { KiroExporter } from "../src/kiro/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { AlignPack } from "@aligntrue/schema";
import { loadFixture, createDefaultScope } from "./helpers/test-fixtures.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "cursor");
const TEST_OUTPUT_DIR = join(import.meta.dirname, "temp-kiro-test-output");

describe("KiroExporter", () => {
  let exporter: KiroExporter;

  beforeEach(() => {
    exporter = new KiroExporter();
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
      expect(exporter.name).toBe("kiro");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });
  });

  describe("Basic Export", () => {
    it("exports single rule to .kiro/steering/ directory", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          guidance: "Test guidance",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      // Normalize path separators for cross-platform compatibility
      expect(result.filesWritten[0].replace(/\\/g, "/")).toMatch(
        /\.kiro\/steering\/rules\.md$/,
      );

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("Test guidance");
    });
  });

  describe("mode hints integration", () => {
    const options: ExportOptions = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: false,
    };

    it("should support off mode (no markers)", async () => {
      const config = { export: { mode_hints: { default: "off" } } };
      const request = createRequest(
        loadFixture(FIXTURES_DIR, "single-rule.yaml").rules,
        createDefaultScope(),
      );
      const result = await exporter.export(request, { ...options, config });
      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).not.toContain("aligntrue:begin");
    });

    it("should support metadata_only mode (markers, no hints)", async () => {
      const config = { export: { mode_hints: { default: "metadata_only" } } };
      const request = createRequest(
        loadFixture(FIXTURES_DIR, "single-rule.yaml").rules,
        createDefaultScope(),
      );
      const result = await exporter.export(request, { ...options, config });
      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("<!-- aligntrue:begin");
      expect(content).not.toContain("Execution intent:");
    });

    it("should support hints mode (markers + visible intent)", async () => {
      const config = { export: { mode_hints: { default: "hints" } } };
      const request = createRequest(
        loadFixture(FIXTURES_DIR, "single-rule.yaml").rules,
        createDefaultScope(),
      );
      const result = await exporter.export(request, { ...options, config });
      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("<!-- aligntrue:begin");
      expect(content).toContain("Execution intent:");
    });
  });
});

// Helper functions

function createRequest(
  rules: AlignRule[],
  scope: ResolvedScope,
): ScopedExportRequest {
  const pack: AlignPack = {
    id: "test-pack",
    version: "1.0.0",
    spec_version: "1",
    rules,
  };

  return {
    scope,
    rules,
    pack,
    outputPath: join(TEST_OUTPUT_DIR, ".kiro", "steering", "rules.md"),
  };
}
