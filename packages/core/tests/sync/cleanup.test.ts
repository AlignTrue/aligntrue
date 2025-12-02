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
  SourceRuleInfo,
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

      // Source has 'security' and 'testing' rules (no nested_location = root)
      const sourceRules: SourceRuleInfo[] = [
        { name: "security" },
        { name: "testing" },
      ];

      const staleGroups = detectStaleExports(tempDir, sourceRules, [
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

      const sourceRules: SourceRuleInfo[] = [
        { name: "security" },
        { name: "testing" },
      ];

      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].files).toEqual(["old.mdc"]);
    });

    it("should skip non-existent directories", () => {
      const sourceRules: SourceRuleInfo[] = [{ name: "security" }];
      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      expect(staleGroups).toHaveLength(0);
    });

    it("should skip single-file exporters", () => {
      const sourceRules: SourceRuleInfo[] = [{ name: "security" }];
      // agents is single-file, should be skipped
      const staleGroups = detectStaleExports(tempDir, sourceRules, ["agents"]);

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

      const sourceRules: SourceRuleInfo[] = [{ name: "security" }];
      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      // Only the file in root should be checked, not nested files
      expect(staleGroups).toHaveLength(0);
    });

    it("should flag root export as stale when rule has nested_location", () => {
      // This tests the key scenario: a rule with nested_location should NOT have a root export
      const cursorRulesDir = join(tempDir, ".cursor", "rules");
      mkdirSync(cursorRulesDir, { recursive: true });

      // Create an export at root level
      writeFileSync(join(cursorRulesDir, "web_stack.mdc"), "web stack content");

      // But the source rule has nested_location: apps/docs
      // So the root export is stale (should be at apps/docs/.cursor/rules/)
      const sourceRules: SourceRuleInfo[] = [
        { name: "web_stack", nestedLocation: "apps/docs" },
      ];

      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].directory).toBe(".cursor/rules");
      expect(staleGroups[0].files).toContain("web_stack.mdc");
    });

    it("should NOT flag nested export as stale when rule has matching nested_location", () => {
      // Create export at the correct nested location
      const nestedCursorDir = join(tempDir, "apps", "docs", ".cursor", "rules");
      mkdirSync(nestedCursorDir, { recursive: true });
      writeFileSync(
        join(nestedCursorDir, "web_stack.mdc"),
        "web stack content",
      );

      // Source rule has nested_location matching the export location
      const sourceRules: SourceRuleInfo[] = [
        { name: "web_stack", nestedLocation: "apps/docs" },
      ];

      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      // No stale exports - the nested export is at the correct location
      expect(staleGroups).toHaveLength(0);
    });

    it("should flag nested export as stale when no rule has that nested_location", () => {
      // Create export at a nested location
      const nestedCursorDir = join(tempDir, "apps", "docs", ".cursor", "rules");
      mkdirSync(nestedCursorDir, { recursive: true });
      writeFileSync(join(nestedCursorDir, "orphan.mdc"), "orphan content");

      // But we have a rule for apps/docs so the nested directory will be scanned
      const sourceRules: SourceRuleInfo[] = [
        { name: "web_stack", nestedLocation: "apps/docs" },
      ];

      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      // orphan.mdc is stale - no matching source
      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].directory).toBe("apps/docs/.cursor/rules");
      expect(staleGroups[0].files).toContain("orphan.mdc");
    });

    it("should handle multiple rules with different nested_locations", () => {
      // Create root and nested exports
      const rootCursorDir = join(tempDir, ".cursor", "rules");
      const docsCursorDir = join(tempDir, "apps", "docs", ".cursor", "rules");
      const cliCursorDir = join(tempDir, "packages", "cli", ".cursor", "rules");

      mkdirSync(rootCursorDir, { recursive: true });
      mkdirSync(docsCursorDir, { recursive: true });
      mkdirSync(cliCursorDir, { recursive: true });

      // Root exports (should be valid for global rule, stale for nested rules)
      writeFileSync(join(rootCursorDir, "global.mdc"), "global content");
      writeFileSync(join(rootCursorDir, "web_stack.mdc"), "stale at root");

      // Nested exports (correct locations)
      writeFileSync(join(docsCursorDir, "web_stack.mdc"), "correct location");
      writeFileSync(join(cliCursorDir, "cli_rules.mdc"), "cli rules");

      const sourceRules: SourceRuleInfo[] = [
        { name: "global" }, // No nested_location = root
        { name: "web_stack", nestedLocation: "apps/docs" },
        { name: "cli_rules", nestedLocation: "packages/cli" },
      ];

      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      // Only root web_stack.mdc should be stale
      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].directory).toBe(".cursor/rules");
      expect(staleGroups[0].files).toContain("web_stack.mdc");
      expect(staleGroups[0].files).not.toContain("global.mdc");
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
      const sourceRules: SourceRuleInfo[] = [
        { name: "security" },
        { name: "testing" },
      ];
      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].files).toEqual(["old-rule.mdc"]);

      // Clean stale
      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.deleted).toEqual(["old-rule.mdc"]);
      expect(existsSync(join(cursorRulesDir, "security.mdc"))).toBe(true);
      expect(existsSync(join(cursorRulesDir, "testing.mdc"))).toBe(true);
      expect(existsSync(join(cursorRulesDir, "old-rule.mdc"))).toBe(false);
    });

    it("should clean stale root exports when rule has nested_location", async () => {
      // Setup: Create export at both root AND nested location
      const rootCursorDir = join(tempDir, ".cursor", "rules");
      const nestedCursorDir = join(tempDir, "apps", "docs", ".cursor", "rules");

      mkdirSync(rootCursorDir, { recursive: true });
      mkdirSync(nestedCursorDir, { recursive: true });

      writeFileSync(join(rootCursorDir, "web_stack.mdc"), "stale at root");
      writeFileSync(join(nestedCursorDir, "web_stack.mdc"), "correct location");

      // Rule has nested_location, so root export is stale
      const sourceRules: SourceRuleInfo[] = [
        { name: "web_stack", nestedLocation: "apps/docs" },
      ];
      const staleGroups = detectStaleExports(tempDir, sourceRules, ["cursor"]);

      expect(staleGroups).toHaveLength(1);
      expect(staleGroups[0].directory).toBe(".cursor/rules");

      // Clean stale
      const result = await cleanStaleExports(tempDir, staleGroups);

      expect(result.deleted).toContain("web_stack.mdc");
      // Root export should be gone
      expect(existsSync(join(rootCursorDir, "web_stack.mdc"))).toBe(false);
      // Nested export should remain
      expect(existsSync(join(nestedCursorDir, "web_stack.mdc"))).toBe(true);
    });
  });
});
