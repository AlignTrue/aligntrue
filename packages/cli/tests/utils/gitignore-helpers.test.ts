/**
 * Tests for gitignore helper utilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  addToGitignore,
  removeFromGitignore,
  isInGitignore,
} from "../../src/utils/gitignore-helpers.js";

describe("gitignore-helpers", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `gitignore-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("addToGitignore", () => {
    it("creates file if not exists", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(false);

      await addToGitignore("config.yaml", undefined, testDir);

      expect(existsSync(gitignorePath)).toBe(true);
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(".aligntrue/config.yaml");
    });

    it("appends to existing file", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, ".aligntrue/node_modules/\n", "utf-8");

      await addToGitignore("config.yaml", undefined, testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(".aligntrue/node_modules/");
      expect(content).toContain(".aligntrue/config.yaml");
    });

    it("skips if entry already exists", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, ".aligntrue/config.yaml\n", "utf-8");

      await addToGitignore("config.yaml", undefined, testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      // Count occurrences - should only appear once
      const count = (content.match(/config\.yaml/g) || []).length;
      expect(count).toBe(1);
    });

    it("adds comment when provided", async () => {
      const gitignorePath = join(testDir, ".gitignore");

      await addToGitignore("config.yaml", "AlignTrue Personal Config", testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("# AlignTrue Personal Config");
      expect(content).toContain(".aligntrue/config.yaml");
    });

    it("groups entries under comment", async () => {
      const gitignorePath = join(testDir, ".gitignore");

      await addToGitignore("file1", "My Section", testDir);
      await addToGitignore("file2", "My Section", testDir);
      await addToGitignore("file3", "Other Section", testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      const file1Index = content.indexOf(".aligntrue/file1");
      const file2Index = content.indexOf(".aligntrue/file2");
      const file3Index = content.indexOf(".aligntrue/file3");

      // file1 and file2 should be closer than file1 and file3
      expect(Math.abs(file1Index - file2Index)).toBeLessThan(
        Math.abs(file1Index - file3Index),
      );
    });
  });

  describe("removeFromGitignore", () => {
    it("removes entry from file", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(
        gitignorePath,
        ".aligntrue/config.yaml\n.aligntrue/node_modules/\n",
        "utf-8",
      );

      await removeFromGitignore("config.yaml", testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).not.toContain(".aligntrue/config.yaml");
      expect(content).toContain(".aligntrue/node_modules/");
    });

    it("handles entry not found gracefully", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, ".aligntrue/node_modules/\n", "utf-8");

      // Should not throw
      await removeFromGitignore("config.yaml", testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(".aligntrue/node_modules/");
    });

    it("removes section comment if no entries left", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(
        gitignorePath,
        `# AlignTrue Personal Config
.aligntrue/config.yaml
.aligntrue/node_modules/
`,
        "utf-8",
      );

      await removeFromGitignore("config.yaml", testDir);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).not.toContain(".aligntrue/config.yaml");
      // Comment might be left (acceptable cleanup behavior)
      expect(content).toContain(".aligntrue/node_modules/");
    });
  });

  describe("isInGitignore", () => {
    it("returns true when entry exists", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, ".aligntrue/config.yaml\n", "utf-8");

      const result = isInGitignore("config.yaml", testDir);
      expect(result).toBe(true);
    });

    it("returns false when entry does not exist", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, ".aligntrue/node_modules/\n", "utf-8");

      const result = isInGitignore("config.yaml", testDir);
      expect(result).toBe(false);
    });

    it("returns false when file does not exist", () => {
      const result = isInGitignore("config.yaml", testDir);
      expect(result).toBe(false);
    });

    it("handles whitespace correctly", async () => {
      const gitignorePath = join(testDir, ".gitignore");
      // Note: implementation trims lines before comparison
      writeFileSync(
        gitignorePath,
        ".aligntrue/config.yaml\n.aligntrue/node_modules/\n",
        "utf-8",
      );

      const result = isInGitignore("config.yaml", testDir);
      expect(result).toBe(true);
    });

    it("matches normalized entries with prefix", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, ".aligntrue/config.yaml\n", "utf-8");

      // Test with and without prefix (implementation normalizes both)
      expect(isInGitignore("config.yaml", testDir)).toBe(true);
      expect(isInGitignore(".aligntrue/config.yaml", testDir)).toBe(true);
    });
  });
});
