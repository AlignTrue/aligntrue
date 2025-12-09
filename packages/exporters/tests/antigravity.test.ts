/**
 * Antigravity exporter tests with snapshot-style assertions
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { AntigravityExporter } from "../src/antigravity/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { Align, AlignSection } from "@aligntrue/schema";
import { loadFixture, createDefaultScope } from "./helpers/test-fixtures.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "antigravity");
const TEST_OUTPUT_DIR = join(
  import.meta.dirname,
  "temp-antigravity-test-output",
);

describe("AntigravityExporter", () => {
  let exporter: AntigravityExporter;

  beforeEach(() => {
    exporter = new AntigravityExporter();
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("Plugin Interface", () => {
    it("implements ExporterPlugin interface", () => {
      expect(exporter.name).toBe("antigravity");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });
  });

  describe("Basic Export", () => {
    it("exports single rule to .md file under .agent/rules", async () => {
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
        /\.agent\/rules\/[a-z0-9-]+\.md$/,
      );
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(existsSync(result.filesWritten[0])).toBe(true);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("---");
      expect(content).toContain("READ-ONLY");
    }, 10000);

    it("exports multiple rules to separate files", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThanOrEqual(1);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content.length).toBeGreaterThan(0);
      expect(result.filesWritten[0].replace(/\\/g, "/")).toContain(
        ".agent/rules/",
      );
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

  describe("Content Hash", () => {
    it("computes deterministic SHA-256 hash", async () => {
      const fixture = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const request = createRequest(fixture.sections, createDefaultScope());
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result1 = await exporter.export(request, options);

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
      expect(result.filesWritten.length).toBeGreaterThan(0);

      const content = readFileSync(result.filesWritten[0], "utf-8");
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
        existsSync(join(TEST_OUTPUT_DIR, ".agent", "rules", "testing.md")),
      ).toBe(false);
    });
  });

  describe("Starter Rule Comment Stripping", () => {
    it("strips STARTER RULE comments from exported content", async () => {
      const sections: AlignSection[] = [
        {
          heading: "Test Rule",
          content: `<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# Test Rule Content

Follow this guidance for testing.`,
          level: 2,
          fingerprint: "test-rule",
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
      expect(content).not.toContain("STARTER RULE:");
      expect(content).toContain("# Test Rule Content");
    });
  });
});

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
    outputPath: join(TEST_OUTPUT_DIR, ".agent", "rules", "testing.md"),
  };
}
