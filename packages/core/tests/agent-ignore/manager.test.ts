/**
 * Tests for ignore file manager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  readIgnoreFile,
  parseIgnoreFile,
  hasPattern,
  hasAlignTrueSection,
  extractAlignTruePatterns,
  removeAlignTrueSection,
  buildAlignTrueSection,
  updateIgnoreFile,
  applyConflictResolution,
  removeAlignTruePatterns,
} from "../../src/agent-ignore/manager.js";

const TEST_DIR = join(process.cwd(), "temp-test-agent-ignore");

describe("Ignore File Manager", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("readIgnoreFile", () => {
    it("should return empty string for non-existent file", () => {
      const content = readIgnoreFile(join(TEST_DIR, ".cursorignore"));
      expect(content).toBe("");
    });

    it("should read existing file", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      writeFileSync(filePath, "node_modules/\n*.log\n", "utf-8");
      const content = readIgnoreFile(filePath);
      expect(content).toContain("node_modules/");
      expect(content).toContain("*.log");
    });
  });

  describe("parseIgnoreFile", () => {
    it("should parse lines correctly", () => {
      const content = "node_modules/\n*.log\n\n# comment\n.env";
      const lines = parseIgnoreFile(content);
      expect(lines).toContain("node_modules/");
      expect(lines).toContain("*.log");
      expect(lines).toContain("# comment");
      expect(lines).toContain(".env");
    });

    it("should filter empty lines", () => {
      const content = "node_modules/\n\n\n*.log\n";
      const lines = parseIgnoreFile(content);
      expect(lines).toHaveLength(2);
    });
  });

  describe("hasPattern", () => {
    it("should detect existing pattern", () => {
      const content = "node_modules/\n*.log\nAGENTS.md\n";
      expect(hasPattern(content, "AGENTS.md")).toBe(true);
    });

    it("should not detect missing pattern", () => {
      const content = "node_modules/\n*.log\n";
      expect(hasPattern(content, "AGENTS.md")).toBe(false);
    });

    it("should skip comments", () => {
      const content = "node_modules/\n# AGENTS.md\n";
      expect(hasPattern(content, "AGENTS.md")).toBe(false);
    });
  });

  describe("hasAlignTrueSection", () => {
    it("should detect AlignTrue section", () => {
      const content = `node_modules/

# AlignTrue: Prevent duplicate context
AGENTS.md
# AlignTrue: End duplicate prevention
`;
      expect(hasAlignTrueSection(content)).toBe(true);
    });

    it("should return false when no section", () => {
      const content = "node_modules/\n*.log\n";
      expect(hasAlignTrueSection(content)).toBe(false);
    });
  });

  describe("extractAlignTruePatterns", () => {
    it("should extract patterns from section", () => {
      const content = `node_modules/

# AlignTrue: Prevent duplicate context
AGENTS.md
CLAUDE.md
# AlignTrue: End duplicate prevention

*.log
`;
      const patterns = extractAlignTruePatterns(content);
      expect(patterns).toContain("AGENTS.md");
      expect(patterns).toContain("CLAUDE.md");
      expect(patterns).not.toContain("*.log");
    });

    it("should return empty array when no section", () => {
      const content = "node_modules/\n*.log\n";
      const patterns = extractAlignTruePatterns(content);
      expect(patterns).toEqual([]);
    });
  });

  describe("removeAlignTrueSection", () => {
    it("should remove section and preserve other content", () => {
      const content = `node_modules/

# AlignTrue: Prevent duplicate context
AGENTS.md
# AlignTrue: End duplicate prevention

*.log
`;
      const result = removeAlignTrueSection(content);
      expect(result).toContain("node_modules/");
      expect(result).toContain("*.log");
      expect(result).not.toContain("AlignTrue");
      expect(result).not.toContain("AGENTS.md");
    });

    it("should handle content without section", () => {
      const content = "node_modules/\n*.log\n";
      const result = removeAlignTrueSection(content);
      expect(result).toBe(content.trim());
    });
  });

  describe("buildAlignTrueSection", () => {
    it("should build section with patterns", () => {
      const section = buildAlignTrueSection(["AGENTS.md", "CLAUDE.md"]);
      expect(section).toContain("# AlignTrue: Prevent duplicate context");
      expect(section).toContain("AGENTS.md");
      expect(section).toContain("CLAUDE.md");
      expect(section).toContain("# AlignTrue: End duplicate prevention");
    });

    it("should return empty string for no patterns", () => {
      const section = buildAlignTrueSection([]);
      expect(section).toBe("");
    });
  });

  describe("updateIgnoreFile", () => {
    it("should create new file with patterns", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      const result = updateIgnoreFile(filePath, ["AGENTS.md"], false);

      expect(result.created).toBe(true);
      expect(result.modified).toBe(false);
      expect(result.patterns).toContain("AGENTS.md");
      expect(existsSync(filePath)).toBe(true);

      const content = readIgnoreFile(filePath);
      expect(content).toContain("AGENTS.md");
    });

    it("should update existing file", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      writeFileSync(filePath, "node_modules/\n", "utf-8");

      const result = updateIgnoreFile(filePath, ["AGENTS.md"], false);

      expect(result.created).toBe(false);
      expect(result.modified).toBe(true);

      const content = readIgnoreFile(filePath);
      expect(content).toContain("node_modules/");
      expect(content).toContain("AGENTS.md");
    });

    it("should not modify if pattern already exists", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      writeFileSync(filePath, "AGENTS.md\n", "utf-8");

      const result = updateIgnoreFile(filePath, ["AGENTS.md"], false);

      expect(result.created).toBe(false);
      expect(result.modified).toBe(false);
    });

    it("should handle dry run", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      const result = updateIgnoreFile(filePath, ["AGENTS.md"], true);

      expect(result.created).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe("applyConflictResolution", () => {
    it("should apply conflict resolution to root", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "agents"],
        nativeFormat: "cursor",
        formatsToIgnore: ["agents"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };

      const updates = applyConflictResolution(conflict, TEST_DIR, false);

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].created).toBe(true);

      const filePath = join(TEST_DIR, ".cursorignore");
      expect(existsSync(filePath)).toBe(true);

      const content = readIgnoreFile(filePath);
      expect(content).toContain("AGENTS.md");
    });

    it("should handle dry run", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "agents"],
        nativeFormat: "cursor",
        formatsToIgnore: ["agents"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };

      const updates = applyConflictResolution(conflict, TEST_DIR, true);

      expect(updates.length).toBeGreaterThan(0);
      const filePath = join(TEST_DIR, ".cursorignore");
      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe("removeAlignTruePatterns", () => {
    it("should remove managed patterns from file", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      const content = `node_modules/

# AlignTrue: Prevent duplicate context
AGENTS.md
# AlignTrue: End duplicate prevention

*.log
`;
      writeFileSync(filePath, content, "utf-8");

      const result = removeAlignTruePatterns(filePath, false);

      expect(result).toBe(true);

      const newContent = readIgnoreFile(filePath);
      expect(newContent).toContain("node_modules/");
      expect(newContent).toContain("*.log");
      expect(newContent).not.toContain("AlignTrue");
    });

    it("should return false for non-existent file", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      const result = removeAlignTruePatterns(filePath, false);
      expect(result).toBe(false);
    });

    it("should return false when no section exists", () => {
      const filePath = join(TEST_DIR, ".cursorignore");
      writeFileSync(filePath, "node_modules/\n", "utf-8");

      const result = removeAlignTruePatterns(filePath, false);
      expect(result).toBe(false);
    });
  });
});
