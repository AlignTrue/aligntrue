import { describe, it, expect } from "vitest";
import {
  parseAlignignore,
  shouldIgnorePath,
  isIgnoredByAlignignore,
} from "../../src/alignignore/parser.js";

describe("Alignignore parser", () => {
  describe("parseAlignignore", () => {
    it("should parse simple patterns", () => {
      const content = `*.tmp
temp/
`;
      const patterns = parseAlignignore(content);
      expect(patterns).toEqual([
        { pattern: "*.tmp", negation: false },
        { pattern: "temp/", negation: false },
      ]);
    });

    it("should handle negation patterns", () => {
      const content = `*.tmp
!important.tmp
`;
      const patterns = parseAlignignore(content);
      expect(patterns).toEqual([
        { pattern: "*.tmp", negation: false },
        { pattern: "important.tmp", negation: true },
      ]);
    });

    it("should skip comments", () => {
      const content = `# This is a comment
*.tmp
# Another comment
temp/`;
      const patterns = parseAlignignore(content);
      expect(patterns).toEqual([
        { pattern: "*.tmp", negation: false },
        { pattern: "temp/", negation: false },
      ]);
    });

    it("should skip empty lines", () => {
      const content = `*.tmp

temp/

`;
      const patterns = parseAlignignore(content);
      expect(patterns).toEqual([
        { pattern: "*.tmp", negation: false },
        { pattern: "temp/", negation: false },
      ]);
    });
  });

  describe("shouldIgnorePath", () => {
    it("should match simple patterns", () => {
      const patterns = parseAlignignore("*.tmp\n");
      expect(shouldIgnorePath("file.tmp", patterns)).toBe(true);
      expect(shouldIgnorePath("file.txt", patterns)).toBe(false);
    });

    it("should handle directory patterns", () => {
      const patterns = parseAlignignore("temp/\n");
      expect(shouldIgnorePath("temp/file.txt", patterns)).toBe(true);
      expect(shouldIgnorePath("nottemp/file.txt", patterns)).toBe(false);
    });

    it("should handle negation patterns (last match wins)", () => {
      const patterns = parseAlignignore("*.tmp\n!important.tmp\n");
      expect(shouldIgnorePath("file.tmp", patterns)).toBe(true);
      expect(shouldIgnorePath("important.tmp", patterns)).toBe(false);
    });

    it("should return false for empty patterns", () => {
      expect(shouldIgnorePath("file.txt", [])).toBe(false);
    });

    it("should handle nested paths", () => {
      const patterns = parseAlignignore("**/*.tmp\n");
      expect(shouldIgnorePath("file.tmp", patterns)).toBe(true);
      expect(shouldIgnorePath("subdir/file.tmp", patterns)).toBe(true);
      expect(shouldIgnorePath("deep/nested/file.tmp", patterns)).toBe(true);
    });
  });

  describe("isIgnoredByAlignignore", () => {
    it("should return false if .alignignore doesn't exist", () => {
      expect(
        isIgnoredByAlignignore("file.txt", "/nonexistent/.alignignore"),
      ).toBe(false);
    });

    it("should work with file paths", () => {
      // This would need a temporary file system for full testing
      // For now, we just test the interface
      expect(typeof isIgnoredByAlignignore("file.txt", ".alignignore")).toBe(
        "boolean",
      );
    });
  });
});
