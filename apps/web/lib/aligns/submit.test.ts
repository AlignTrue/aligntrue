/**
 * Tests for submit flow utilities
 *
 * Tests file type detection and pack vs single file handling logic.
 */

import { describe, it, expect } from "vitest";

// Test the file extension validation logic (extracted from route.ts)
const ALLOWED_EXTENSIONS = [
  ".md",
  ".mdc",
  ".mdx",
  ".markdown",
  ".yaml",
  ".yml",
] as const;

const ALLOWED_FILENAMES = [
  ".clinerules",
  ".cursorrules",
  ".goosehints",
] as const;

function hasAllowedExtension(url: string): boolean {
  const lower = url.toLowerCase();
  const filename = lower.split("/").pop() || "";
  if (
    ALLOWED_FILENAMES.includes(filename as (typeof ALLOWED_FILENAMES)[number])
  )
    return true;
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Test pack detection logic (extracted from route.ts)
function isPackNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("no .align.yaml") || message.includes("manifest not found")
  );
}

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
    it("allows .yaml files", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/config.yaml",
        ),
      ).toBe(true);
    });

    it("allows .yml files", () => {
      expect(
        hasAllowedExtension("https://github.com/org/repo/blob/main/config.yml"),
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

    it("allows mixed case .Yaml", () => {
      expect(
        hasAllowedExtension(
          "https://github.com/org/repo/blob/main/config.Yaml",
        ),
      ).toBe(true);
    });
  });
});

describe("isPackNotFoundError", () => {
  it("returns true for 'no .align.yaml' error", () => {
    expect(
      isPackNotFoundError(new Error("No .align.yaml found in directory")),
    ).toBe(true);
  });

  it("returns true for 'manifest not found' error", () => {
    expect(isPackNotFoundError(new Error("Manifest not found at path"))).toBe(
      true,
    );
  });

  it("returns false for other errors", () => {
    expect(isPackNotFoundError(new Error("Network timeout"))).toBe(false);
    expect(isPackNotFoundError(new Error("Rate limit exceeded"))).toBe(false);
    expect(isPackNotFoundError(new Error("Invalid manifest format"))).toBe(
      false,
    );
  });

  it("returns false for non-Error values", () => {
    expect(isPackNotFoundError("string error")).toBe(false);
    expect(isPackNotFoundError(null)).toBe(false);
    expect(isPackNotFoundError(undefined)).toBe(false);
    expect(isPackNotFoundError({ message: "no .align.yaml" })).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isPackNotFoundError(new Error("NO .ALIGN.YAML FOUND"))).toBe(true);
    expect(isPackNotFoundError(new Error("MANIFEST NOT FOUND"))).toBe(true);
  });
});

describe("submit flow behavior", () => {
  describe("pack vs single file routing", () => {
    it("pack errors that are not 'not found' should not fall through to single file", () => {
      // Errors like "invalid manifest" or "too many files" should not
      // trigger single-file fallback
      const invalidManifest = new Error("Manifest missing required 'id'");
      const tooManyFiles = new Error("Pack exceeds file limit");
      const networkError = new Error("Failed to fetch repository tree");

      expect(isPackNotFoundError(invalidManifest)).toBe(false);
      expect(isPackNotFoundError(tooManyFiles)).toBe(false);
      expect(isPackNotFoundError(networkError)).toBe(false);
    });

    it("only 'no manifest' errors should fall through to single file handling", () => {
      const noManifest = new Error("No .align.yaml found");
      const manifestNotFound = new Error(
        "Manifest not found at specified path",
      );

      expect(isPackNotFoundError(noManifest)).toBe(true);
      expect(isPackNotFoundError(manifestNotFound)).toBe(true);
    });
  });
});
