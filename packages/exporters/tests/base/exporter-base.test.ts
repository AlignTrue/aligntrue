/**
 * Tests for ExporterBase (Code consolidation)
 *
 * Validates common exporter functionality consolidated in base class.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExporterBase } from "../../src/base/exporter-base.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import type { AlignRule } from "@aligntrue/schema";

/**
 * Test exporter implementation
 */
class TestExporter extends ExporterBase {
  name = "test";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { rules } = request;
    const { outputDir, dryRun = false } = options;

    const content = "test export content";
    const outputPath = `${outputDir}/test.txt`;

    const contentHash = this.computeHash({ rules });
    const fidelityNotes = this.computeFidelityNotes(rules);
    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }
}

describe("ExporterBase", () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  describe("computeHash", () => {
    it("produces deterministic hash", () => {
      const obj = { rules: [{ id: "rule1", guidance: "test" }] };
      const hash1 = exporter["computeHash"](obj);
      const hash2 = exporter["computeHash"](obj);
      expect(hash1).toBe(hash2);
    });

    it("produces SHA-256 hex string (64 chars)", () => {
      const obj = { rules: [{ id: "rule1" }] };
      const hash = exporter["computeHash"](obj);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces same hash for objects with different key order", () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      const hash1 = exporter["computeHash"](obj1);
      const hash2 = exporter["computeHash"](obj2);
      expect(hash1).toBe(hash2);
    });

    it("excludes vendor.*.volatile fields by default", () => {
      const obj1 = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["test.session_id"] },
          test: { session_id: "abc123" },
        },
      };
      const obj2 = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["test.session_id"] },
          test: { session_id: "xyz789" },
        },
      };
      // Should have same hash (session_id excluded)
      const hash1 = exporter["computeHash"](obj1);
      const hash2 = exporter["computeHash"](obj2);
      expect(hash1).toBe(hash2);
    });
  });

  describe("computeFidelityNotes", () => {
    it("returns empty array for rules without unmapped fields", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      expect(notes).toEqual([]);
    });

    it("notes unmapped 'check' field", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
          check: { command: "npm test" },
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0]).toContain("check");
    });

    it("notes unmapped 'autofix' field", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
          autofix: { command: "npm run fix" },
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0]).toContain("autofix");
    });

    it("notes multiple unmapped fields", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
          check: { command: "npm test" },
          autofix: { command: "npm run fix" },
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0]).toContain("check");
      expect(notes[0]).toContain("autofix");
    });

    it("notes cross-agent vendor fields", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
          vendor: {
            cursor: { mode: "native" },
            aider: { style: "diff" },
          },
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      expect(notes.length).toBeGreaterThan(0);
      const vendorNote = notes.find((n) => n.includes("Vendor-specific"));
      expect(vendorNote).toBeDefined();
      expect(vendorNote).toContain("cursor");
      expect(vendorNote).toContain("aider");
    });

    it("ignores own vendor fields", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
          vendor: {
            test: { custom: "field" }, // Should be ignored (matches exporter name)
          },
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      // Should not note vendor.test since it's this exporter's namespace
      const vendorNote = notes.find((n) => n.includes("Vendor-specific"));
      expect(vendorNote).toBeUndefined();
    });

    it("ignores vendor._meta", () => {
      const rules: AlignRule[] = [
        {
          id: "rule1",
          guidance: "test guidance",
          applies_to: ["**/*"],
          vendor: {
            _meta: { volatile: ["test.session"] },
          },
        },
      ];
      const notes = exporter["computeFidelityNotes"](rules);
      expect(notes).toEqual([]);
    });
  });

  describe("writeFile", () => {
    it("returns file path when writing", async () => {
      // Note: Actual file writing is mocked in exporter tests
      // This tests the interface behavior
      const path = "/tmp/test.txt";
      const content = "test content";
      const result = await exporter["writeFile"](path, content, false);
      expect(result).toEqual([path]);
    });

    it("returns empty array for dry-run", async () => {
      const path = "/tmp/test.txt";
      const content = "test content";
      const result = await exporter["writeFile"](path, content, true);
      expect(result).toEqual([]);
    });
  });

  describe("buildResult", () => {
    it("builds result with required fields", () => {
      const result = exporter["buildResult"](["/tmp/test.txt"], "abc123hash");
      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual(["/tmp/test.txt"]);
      expect(result.contentHash).toBe("abc123hash");
      expect(result.fidelityNotes).toBeUndefined();
    });

    it("includes fidelity notes when provided", () => {
      const notes = ["Note 1", "Note 2"];
      const result = exporter["buildResult"](
        ["/tmp/test.txt"],
        "abc123hash",
        notes,
      );
      expect(result.fidelityNotes).toEqual(notes);
    });

    it("omits fidelity notes when empty", () => {
      const result = exporter["buildResult"](
        ["/tmp/test.txt"],
        "abc123hash",
        [],
      );
      expect(result.fidelityNotes).toBeUndefined();
    });
  });

  describe("integration", () => {
    it("test exporter can export with all base methods", async () => {
      const request: ScopedExportRequest = {
        scope: {
          path: ".",
          isDefault: true,
          normalizedPath: "default",
        },
        rules: [
          {
            id: "rule1",
            guidance: "test guidance",
            applies_to: ["**/*"],
          },
        ],
      };

      const options: ExportOptions = {
        outputDir: "/tmp",
        dryRun: true,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual([]); // dry-run
      expect(result.contentHash).toHaveLength(64);
      expect(result.fidelityNotes).toBeUndefined(); // no unmapped fields
    });

    it("generates fidelity notes for unmapped fields", async () => {
      const request: ScopedExportRequest = {
        scope: {
          path: ".",
          isDefault: true,
          normalizedPath: "default",
        },
        rules: [
          {
            id: "rule1",
            guidance: "test guidance",
            applies_to: ["**/*"],
            check: { command: "npm test" },
          },
        ],
      };

      const options: ExportOptions = {
        outputDir: "/tmp",
        dryRun: true,
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.fidelityNotes).toBeDefined();
      expect(result.fidelityNotes!.length).toBeGreaterThan(0);
      expect(result.fidelityNotes![0]).toContain("check");
    });
  });
});
