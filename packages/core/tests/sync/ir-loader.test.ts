/**
 * Tests for IR loader
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { loadIR } from "../../src/sync/ir-loader.js";

const TEST_DIR = join(process.cwd(), "packages/core/tests/sync/fixtures");

describe("IR Loader", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = ["valid.yaml", "invalid-yaml.yaml", "unsupported.txt"];

    for (const file of testFiles) {
      const path = join(TEST_DIR, file);
      if (existsSync(path)) {
        try {
          unlinkSync(path);
        } catch {
          // Ignore errors
        }
      }
    }
  });

  // Removed markdown loading tests - IR files are now YAML-only (.aligntrue/rules)
  // Users edit agent files (AGENTS.md, .cursor/*.mdc) which are synced to the internal IR

  describe("Load from YAML", () => {
    it("loads valid YAML", async () => {
      const yaml = `id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: "Testing instructions"
    level: 2
    content: "Test rule guidance content"
    fingerprint: "testing-example-rule"
`;
      const path = join(TEST_DIR, "valid.yaml");
      writeFileSync(path, yaml, "utf8");

      const ir = await loadIR(path);

      expect(ir.id).toBe("test-align");
      expect(ir.version).toBe("1.0.0");
      expect(ir.spec_version).toBe("1");
      expect(ir.sections).toHaveLength(1);
      expect(ir.sections[0].heading).toBe("Testing instructions");
    });

    it("fails on invalid YAML syntax", async () => {
      const yaml = `id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: "Test"
    level: 2
    content: "unclosed string
`;
      const path = join(TEST_DIR, "invalid-yaml.yaml");
      writeFileSync(path, yaml, "utf8");

      await expect(loadIR(path)).rejects.toThrow(/line|column/);
    });

    it("surfaces YAML line numbers in errors", async () => {
      const yaml = `id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: "Test"
    level: 2
`;
      const path = join(TEST_DIR, "invalid-yaml.yaml");
      writeFileSync(path, yaml, "utf8");

      await expect(loadIR(path)).rejects.toThrow();
    });
  });

  describe("Format auto-detection", () => {
    it("detects .yaml extension", async () => {
      const yaml = `id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - heading: "Testing instructions"
    level: 2
    content: "Test rule guidance"
    fingerprint: "testing-example-rule"
`;
      const path = join(TEST_DIR, "valid.yaml");
      writeFileSync(path, yaml, "utf8");

      const ir = await loadIR(path);
      expect(ir.id).toBe("test-align");
    });

    it("rejects unsupported extensions", async () => {
      const path = join(TEST_DIR, "unsupported.txt");
      writeFileSync(path, "invalid", "utf8");

      await expect(loadIR(path)).rejects.toThrow(/Unsupported file format/);
    });
  });

  describe("Error handling", () => {
    it("fails on non-existent file", async () => {
      const path = join(TEST_DIR, "nonexistent.yaml");

      await expect(loadIR(path)).rejects.toThrow(/not found/);
    });

    it("fails on invalid IR schema", async () => {
      const yaml = `id: test-align
version: 1.0.0
spec_version: "1"
sections:
  - id: testing.example.rule
    severity: invalid_severity
`;
      const path = join(TEST_DIR, "invalid-yaml.yaml");
      writeFileSync(path, yaml, "utf8");

      await expect(loadIR(path)).rejects.toThrow(/Invalid IR/);
    });
  });
});
