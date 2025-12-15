import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
  detectConflicts,
  resolveConflict,
} from "../../src/import/conflict-resolver.js";

describe("conflict-resolver", () => {
  let testDir: string;
  let rulesDir: string;

  beforeEach(() => {
    // Create temp directory
    testDir = join(
      tmpdir(),
      `aligntrue-conflict-test-${randomBytes(8).toString("hex")}`,
    );
    rulesDir = join(testDir, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("detectConflicts", () => {
    it("returns empty array when no conflicts", () => {
      const conflicts = detectConflicts(
        [
          {
            filename: "new-rule.md",
            title: "New Rule",
            source: "https://example.com",
          },
        ],
        rulesDir,
      );
      expect(conflicts).toHaveLength(0);
    });

    it("detects conflicts with existing files", () => {
      // Create existing file
      writeFileSync(join(rulesDir, "existing.md"), "# Existing Rule");

      const conflicts = detectConflicts(
        [
          {
            filename: "existing.md",
            title: "Incoming Rule",
            source: "https://example.com",
          },
          {
            filename: "new-rule.md",
            title: "New Rule",
            source: "https://example.com",
          },
        ],
        rulesDir,
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.filename).toBe("existing.md");
      expect(conflicts[0]!.incomingTitle).toBe("Incoming Rule");
    });

    it("detects conflicts with nested paths", () => {
      const nestedDir = join(rulesDir, "deep");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, "rule.md"), "# Existing Rule");

      const conflicts = detectConflicts(
        [
          {
            filename: "deep/rule.md",
            title: "Incoming Nested Rule",
            source: "https://example.com/nested",
          },
        ],
        rulesDir,
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.filename).toBe("deep/rule.md");
      expect(conflicts[0]!.existingPath).toBe(
        join(rulesDir, "deep", "rule.md"),
      );
    });
  });

  describe("resolveConflict", () => {
    it("generates unique filename for keep-both", () => {
      // Create existing file
      writeFileSync(join(rulesDir, "rule.md"), "# Existing");

      const conflict = {
        filename: "rule.md",
        existingPath: join(rulesDir, "rule.md"),
        incomingTitle: "Incoming Rule",
        incomingSource: "https://example.com",
      };

      const result = resolveConflict(conflict, "keep-both", testDir);

      expect(result.resolution).toBe("keep-both");
      expect(result.finalFilename).toBe("rule-1.md");
      expect(result.backupPath).toBeUndefined();
    });

    it("generates incrementing filenames when multiple conflicts", () => {
      // Create existing files
      writeFileSync(join(rulesDir, "rule.md"), "# Existing");
      writeFileSync(join(rulesDir, "rule-1.md"), "# Existing 1");

      const conflict = {
        filename: "rule.md",
        existingPath: join(rulesDir, "rule.md"),
        incomingTitle: "Incoming Rule",
        incomingSource: "https://example.com",
      };

      const result = resolveConflict(conflict, "keep-both", testDir);

      expect(result.finalFilename).toBe("rule-2.md");
    });

    it("preserves directory structure for nested keep-both", () => {
      const nestedDir = join(rulesDir, "deep");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, "rule.md"), "# Existing");

      const conflict = {
        filename: "deep/rule.md",
        existingPath: join(rulesDir, "deep", "rule.md"),
        incomingTitle: "Incoming Nested Rule",
        incomingSource: "https://example.com/nested",
      };

      const result = resolveConflict(conflict, "keep-both", testDir);

      expect(result.resolution).toBe("keep-both");
      expect(result.finalFilename).toBe("deep/rule-1.md");
    });

    it("preserves directory structure on Windows-style paths", () => {
      // Simulate Windows path separators in existingPath
      const conflict = {
        filename: "nested/rule.md",
        existingPath:
          "C:\\\\workspace\\\\.aligntrue\\\\rules\\\\nested\\\\rule.md",
        incomingTitle: "Incoming Nested Rule",
        incomingSource: "https://example.com/nested",
      };

      const result = resolveConflict(conflict, "keep-both", "C:\\\\workspace");

      expect(result.finalFilename).toBe("nested/rule-1.md");
    });

    it("creates backup for replace resolution", () => {
      // Create existing file
      writeFileSync(join(rulesDir, "rule.md"), "# Existing");

      const conflict = {
        filename: "rule.md",
        existingPath: join(rulesDir, "rule.md"),
        incomingTitle: "Incoming Rule",
        incomingSource: "https://example.com",
      };

      const result = resolveConflict(conflict, "replace", testDir);

      expect(result.resolution).toBe("replace");
      expect(result.finalFilename).toBe("rule.md");
      expect(result.backupPath).toBeDefined();
      expect(existsSync(result.backupPath!)).toBe(true);
    });

    it("returns skip resolution without changes", () => {
      const conflict = {
        filename: "rule.md",
        existingPath: join(rulesDir, "rule.md"),
        incomingTitle: "Incoming Rule",
        incomingSource: "https://example.com",
      };

      const result = resolveConflict(conflict, "skip", testDir);

      expect(result.resolution).toBe("skip");
      expect(result.finalFilename).toBe("rule.md");
      expect(result.backupPath).toBeUndefined();
    });
  });
});
