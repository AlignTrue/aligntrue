/**
 * Tests for sync cleanup functions
 * Tests for detecting and removing stale exported files
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import {
  detectStaleExports,
  cleanStaleExports,
  getMultiFileExporterPath,
  getAllMultiFileExporterPaths,
  StaleExportGroup,
} from "../../src/sync/cleanup.js";

describe("Cleanup Functions", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(process.cwd(), "temp-cleanup-test-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });

  describe("getMultiFileExporterPath", () => {
    it("should return path for multi-file exporter", () => {
      expect(getMultiFileExporterPath("cursor")).toBe(".cursor/rules");
      expect(getMultiFileExporterPath("amazonq")).toBe(".amazonq/rules");
      expect(getMultiFileExporterPath("openhands")).toBe(
        ".openhands/microagents",
      );
    });

    it("should return undefined for single-file exporter", () => {
      expect(getMultiFileExporterPath("agents")).toBeUndefined();
      expect(getMultiFileExporterPath("firebender")).toBeUndefined();
    });

    it("should return undefined for non-existent exporter", () => {
      expect(getMultiFileExporterPath("non-existent")).toBeUndefined();
    });
  });

  describe("getAllMultiFileExporterPaths", () => {
    it("should return all multi-file exporter paths", () => {
      const paths = getAllMultiFileExporterPaths();
      expect(paths.cursor).toBe(".cursor/rules");
      expect(paths.amazonq).toBe(".amazonq/rules");
      expect(paths.kilocode).toBe(".kilocode/rules");
      expect(Object.keys(paths).length).toBeGreaterThan(5);
    });
  });

  describe("detectStaleExports", () => {
    it("should detect stale files with no matching source", () => {
      // Create export directories and files
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      const amazonqRulesDir = join(tempDir, ".amazonq", "rules");

      // Create directories first
      mkdirSync(cursorRulesDir, { recursive: true });
      mkdirSync(amazonqRulesDir, { recursive: true });

      writeFileSync(join(cursorRulesDir, "security.mdc"), "security content");
      writeFileSync(join(cursorRulesDir, "testing.mdc"), "testing content");
      writeFileSync(
        join(cursorRulesDir, "old-security.mdc"),
        "old security content",
      );
      writeFileSync(join(amazonqRulesDir, "testing.md"), "testing content");
      writeFileSync(join(amazonqRulesDir, "legacy.md"), "legacy content");

      // Source has 'security' and 'testing' rules
      const sourceNames = ["security", "testing"];

      const staleGroups = detectStaleExports(tempDir, sourceNames, [
        "cursor",
        "amazonq",
      ]);

      expect(staleGroups).toHaveLength(2);

      // Check cursor exports
      const cursorStale = staleGroups.find((g) => g.agent === "cursor");
      expect(cursorStale).toBeDefined();
      expect(cursorStale?.files).toContain("old-security.mdc");
      expect(cursorStale?.files).not.toContain("security.mdc");
      expect(cursorStale?.files).not.toContain("testing.mdc");

      // Check amazonq exports
      const amazonqStale = staleGroups.find((g) => g.agent === "amazonq");
      expect(amazonqStale).toBeDefined();
      expect(amazonqStale?.files).toContain("legacy.md");
      expect(amazonqStale?.files).not.toContain("testing.md");
    });

    it("should handle case-insensitive matching", () => {
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      mkdirSync(cursorRulesDir, { recursive: true });
      writeFileSync(join(cursorRulesDir, "Security.mdc"), "content");
      writeFileSync(join(cursorRulesDir, "TESTING.mdc"), "content");
      writeFileSync(join(cursorRulesDir, "old.mdc"), "content");

      const sourceNames = ["security", "testing"]; // lowercase

      const staleGroups = detectStaleExports(tempDir, sourceNames, ["cursor"]);

      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].files).toEqual(["old.mdc"]);
    });

    it("should skip non-existent directories", () => {
      const sourceNames = ["security"];
      const staleGroups = detectStaleExports(tempDir, sourceNames, ["cursor"]);

      expect(staleGroups).toHaveLength(0);
    });

    it("should skip single-file exporters", () => {
      const sourceNames = ["security"];
      // agents is single-file, should be skipped
      const staleGroups = detectStaleExports(tempDir, sourceNames, ["agents"]);

      expect(staleGroups).toHaveLength(0);
    });

    it("should skip directories in export paths", () => {
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      mkdirSync(cursorRulesDir, { recursive: true });
      writeFileSync(join(cursorRulesDir, "security.mdc"), "content");
      // Create a subdirectory
      const subDir = join(cursorRulesDir, "subdir");
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, "nested.mdc"), "content");

      const sourceNames = ["security"];
      const staleGroups = detectStaleExports(tempDir, sourceNames, ["cursor"]);

      // Only the file in root should be checked, not nested files
      expect(staleGroups).toHaveLength(0);
    });
  });

  describe("cleanStaleExports", () => {
    it("should delete stale files", async () => {
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      mkdirSync(cursorRulesDir, { recursive: true });
      const staleFile = join(cursorRulesDir, "old-security.mdc");

      writeFileSync(staleFile, "old content");
      expect(existsSync(staleFile)).toBe(true);

      const staleGroups: StaleExportGroup[] = [
        {
          directory: ".cursor/rules",
          agent: "cursor",
          files: ["old-security.mdc"],
        },
      ];

      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.deleted).toEqual(["old-security.mdc"]);
      expect(result.freedBytes).toBeGreaterThan(0);
      expect(result.warnings).toHaveLength(0);
      expect(existsSync(staleFile)).toBe(false);
    });

    it("should handle multiple stale files", async () => {
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      const amazonqRulesDir = join(tempDir, ".amazonq", "rules");

      mkdirSync(cursorRulesDir, { recursive: true });
      mkdirSync(amazonqRulesDir, { recursive: true });

      writeFileSync(join(cursorRulesDir, "old1.mdc"), "content1");
      writeFileSync(join(cursorRulesDir, "old2.mdc"), "content2");
      writeFileSync(join(amazonqRulesDir, "legacy.md"), "legacy");

      const staleGroups: StaleExportGroup[] = [
        {
          directory: ".cursor/rules",
          agent: "cursor",
          files: ["old1.mdc", "old2.mdc"],
        },
        {
          directory: ".amazonq/rules",
          agent: "amazonq",
          files: ["legacy.md"],
        },
      ];

      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.deleted).toEqual(["old1.mdc", "old2.mdc", "legacy.md"]);
      expect(result.warnings).toHaveLength(0);
    });

    it("should return empty result for no stale groups", async () => {
      const result = await cleanStaleExports(tempDir, []);

      expect(result.deleted).toHaveLength(0);
      expect(result.freedBytes).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle missing files gracefully", async () => {
      const staleGroups: StaleExportGroup[] = [
        {
          directory: ".cursor/rules",
          agent: "cursor",
          files: ["nonexistent.mdc"],
        },
      ];

      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.deleted).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should track freed bytes correctly", async () => {
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      mkdirSync(cursorRulesDir, { recursive: true });
      const content1 = "content1"; // 8 bytes
      const content2 = "content2"; // 8 bytes
      writeFileSync(join(cursorRulesDir, "file1.mdc"), content1);
      writeFileSync(join(cursorRulesDir, "file2.mdc"), content2);

      const staleGroups: StaleExportGroup[] = [
        {
          directory: ".cursor/rules",
          agent: "cursor",
          files: ["file1.mdc", "file2.mdc"],
        },
      ];

      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.freedBytes).toBe(16); // 8 + 8 bytes
    });
  });

  describe("Integration: detect and clean", () => {
    it("should detect stale exports and clean them", async () => {
      // Setup exports
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      mkdirSync(cursorRulesDir, { recursive: true });
      writeFileSync(join(cursorRulesDir, "security.mdc"), "security");
      writeFileSync(join(cursorRulesDir, "testing.mdc"), "testing");
      writeFileSync(join(cursorRulesDir, "old-rule.mdc"), "old");

      // Detect stale
      const sourceNames = ["security", "testing"];
      const staleGroups = detectStaleExports(tempDir, sourceNames, ["cursor"]);

      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].files).toEqual(["old-rule.mdc"]);

      // Clean stale
      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.deleted).toEqual(["old-rule.mdc"]);
      expect(existsSync(join(cursorRulesDir, "security.mdc"))).toBe(true);
      expect(existsSync(join(cursorRulesDir, "testing.mdc"))).toBe(true);
      expect(existsSync(join(cursorRulesDir, "old-rule.mdc"))).toBe(false);
    });
  });
});
