/**
 * Firebender exporter tests with mode hints support
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { FirebenderExporter } from "../src/firebender/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { AlignRule } from "@aligntrue/schema";
import { parseYamlToJson } from "@aligntrue/schema";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "cursor");
const TEST_OUTPUT_DIR = join(
  import.meta.dirname,
  "temp-firebender-test-output",
);

describe("FirebenderExporter", () => {
  let exporter: FirebenderExporter;

  beforeEach(() => {
    exporter = new FirebenderExporter();
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
      expect(exporter.name).toBe("firebender");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });
  });

  describe("Basic Export", () => {
    it("exports single rule to firebender.json", async () => {
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
      expect(result.filesWritten[0]).toBe(
        join(TEST_OUTPUT_DIR, "firebender.json"),
      );

      const content = readFileSync(result.filesWritten[0], "utf-8");
      const output = JSON.parse(content);
      expect(output.rules).toHaveLength(1);
      expect(output.rules[0].guidance).toBe("Test guidance");
    });
  });

  describe("mode hints integration", () => {
    const options: ExportOptions = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: false,
    };

    it("should include mode fields in JSON output", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          mode: "always",
          description: "Test description",
          tags: ["typescript"],
          guidance: "Test guidance",
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const result = await exporter.export(request, options);
      expect(result.success).toBe(true);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      const output = JSON.parse(content);
      expect(output.rules[0]).toHaveProperty("mode", "always");
      expect(output.rules[0]).toHaveProperty("description", "Test description");
      expect(output.rules[0]).toHaveProperty("tags", ["typescript"]);
    });

    it("should apply token caps and include warnings", async () => {
      const manyRules = Array(30)
        .fill(null)
        .map((_, i) => ({
          id: `test.rule.${i}`,
          severity: "error" as const,
          applies_to: ["**/*"],
          guidance: `Test guidance ${i}`.repeat(100), // Make it long
        }));

      const config = { export: { max_hint_blocks: 10 } };
      const request = createRequest(manyRules, createDefaultScope());
      const result = await exporter.export(request, { ...options, config });

      const content = readFileSync(result.filesWritten[0], "utf-8");
      const output = JSON.parse(content);
      expect(output.rules.length).toBeLessThanOrEqual(10);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it("should work without mode fields (backward compat)", async () => {
      const rules: AlignRule[] = [
        {
          id: "test.rule.id",
          severity: "error",
          applies_to: ["**/*"],
          guidance: "Test guidance",
          // No mode/description/tags
        },
      ];

      const request = createRequest(rules, createDefaultScope());
      const result = await exporter.export(request, options);
      expect(result.success).toBe(true);

      const content = readFileSync(result.filesWritten[0], "utf-8");
      const output = JSON.parse(content);
      expect(output.rules[0]).not.toHaveProperty("mode");
      expect(output.rules[0]).not.toHaveProperty("description");
      expect(output.rules[0]).not.toHaveProperty("tags");
    });
  });
});

// Helper functions

function loadFixture(filename: string): { rules: AlignRule[] } {
  const filepath = join(FIXTURES_DIR, filename);
  const yaml = readFileSync(filepath, "utf-8");
  const data = parseYamlToJson(yaml) as any;
  return { rules: data.rules };
}

function createRequest(
  rules: AlignRule[],
  scope: ResolvedScope,
): ScopedExportRequest {
  return {
    scope,
    rules,
    outputPath: join(TEST_OUTPUT_DIR, "firebender.json"),
  };
}

function createDefaultScope(): ResolvedScope {
  return {
    path: ".",
    normalizedPath: ".",
    isDefault: true,
    include: ["**/*"],
  };
}
