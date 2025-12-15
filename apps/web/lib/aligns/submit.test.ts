/**
 * Tests for submit flow utilities
 *
 * Tests file type detection and pack vs single file handling logic.
 */

import { describe, it, expect } from "vitest";

import { hasAllowedExtension } from "./url-validation";

describe("hasAllowedExtension", () => {
  describe("markdown files", () => {
    it("allows .md files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/rules.md"),
      ).toBe(true);
    });

    it("allows .mdc files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/rules.mdc"),
      ).toBe(true);
    });

    it("allows .mdx files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/rules.mdx"),
      ).toBe(true);
    });

    it("allows .markdown files", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/README.markdown",
        ),
      ).toBe(true);
    });
  });

  describe("data files", () => {
    it("allows .xml files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/rules.xml"),
      ).toBe(true);
    });
  });

  describe("agent-specific files", () => {
    it("allows .clinerules", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/.clinerules",
        ),
      ).toBe(true);
    });

    it("allows .cursorrules", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/.cursorrules",
        ),
      ).toBe(true);
    });

    it("allows .goosehints", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/.goosehints",
        ),
      ).toBe(true);
    });
  });

  describe("unsupported files", () => {
    it("rejects .ts files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/index.ts"),
      ).toBe(false);
    });

    it("rejects .js files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/index.js"),
      ).toBe(false);
    });

    it("rejects .py files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/script.py"),
      ).toBe(false);
    });

    it("rejects files with no extension", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/Makefile"),
      ).toBe(false);
    });

    it("rejects .exe files", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/program.exe",
        ),
      ).toBe(false);
    });
  });

  describe("case insensitivity", () => {
    it("allows uppercase .MD", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/README.MD"),
      ).toBe(true);
    });
  });
});
