/**
 * Junie exporter tests with mode hints support
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { JunieExporter } from "../src/junie/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { loadFixture, createDefaultScope } from "./helpers/test-fixtures.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "cursor");
const TEST_OUTPUT_DIR = join(import.meta.dirname, "temp-junie-test-output");

describe("JunieExporter", () => {
  let exporter: JunieExporter;

  beforeEach(() => {
    exporter = new JunieExporter();
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
      expect(exporter.name).toBe("junie");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });
  });

  describe("Basic Export", () => {
    it("exports sections to .junie/guidelines.md", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };
      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      expect(result.filesWritten[0]).toBe(
        join(TEST_OUTPUT_DIR, ".junie", "guidelines.md"),
      );
    });
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
    outputPath: join(TEST_OUTPUT_DIR, ".junie", "guidelines.md"),
  };
}
