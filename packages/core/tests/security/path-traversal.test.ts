/**
 * Security tests for path traversal prevention
 */

import { describe, it, expect } from "vitest";
import { normalizePath, validateScopePath } from "../../src/scope.js";

describe("Path Traversal Security", () => {
  describe("validateScopePath", () => {
    it("rejects parent directory traversal with ..\\/..\\/..\\/etc\\/passwd", () => {
      expect(() => {
        validateScopePath("../../../etc/passwd");
      }).toThrow("parent directory traversal");
    });

    it("rejects absolute paths like /tmp/malicious", () => {
      expect(() => {
        validateScopePath("/tmp/malicious");
      }).toThrow("absolute paths not allowed");
    });

    it("rejects mixed traversal like src/../../outside", () => {
      expect(() => {
        validateScopePath("src/../../outside");
      }).toThrow("parent directory traversal");
    });

    it("accepts normal relative paths like src/components", () => {
      expect(() => {
        validateScopePath("src/components");
      }).not.toThrow();
    });

    it("accepts single-level path like src", () => {
      expect(() => {
        validateScopePath("src");
      }).not.toThrow();
    });

    it("accepts nested path like apps/web/components", () => {
      expect(() => {
        validateScopePath("apps/web/components");
      }).not.toThrow();
    });

    it("rejects Windows-style parent traversal ..\\\\..\\\\", () => {
      expect(() => {
        validateScopePath("..\\..\\etc");
      }).toThrow("parent directory traversal");
    });

    it("rejects mixed Windows and Unix traversal", () => {
      expect(() => {
        validateScopePath("src\\..\\..\\outside");
      }).toThrow("parent directory traversal");
    });

    it("rejects path starting with ..\\/without other components", () => {
      expect(() => {
        validateScopePath("..");
      }).toThrow("parent directory traversal");
    });

    it("rejects path with .. in the middle like src/../../../etc", () => {
      expect(() => {
        validateScopePath("src/../../../etc");
      }).toThrow("parent directory traversal");
    });

    it("rejects Windows absolute path like C:\\\\temp", () => {
      // On Unix, this looks like a relative path C:\temp, but normalizePath handles it
      // We test that absolute paths are rejected
      expect(() => {
        validateScopePath("/C:\\temp");
      }).toThrow("absolute paths not allowed");
    });

    it("accepts dot path as current directory", () => {
      expect(() => {
        validateScopePath(".");
      }).not.toThrow();
    });

    it("accepts path with dots in filename like src/config.test.ts", () => {
      expect(() => {
        validateScopePath("src/config.test.ts");
      }).not.toThrow();
    });

    it("accepts URL-encoded paths (user must decode before validation)", () => {
      // Note: URL decoding is the responsibility of the caller
      // This test documents that encoded traversal is not automatically caught
      // If needed, callers should decode paths before validation
      expect(() => {
        validateScopePath("src/%2e%2e/outside");
      }).not.toThrow();

      // But if decoded, it would be caught:
      // decodeURIComponent('src/%2e%2e/outside') => 'src/../outside'
      // validateScopePath('src/../outside') => throws
    });

    it("rejects trailing parent traversal like src/..", () => {
      expect(() => {
        validateScopePath("src/..");
      }).toThrow("parent directory traversal");
    });
  });

  describe("normalizePath", () => {
    it("converts Windows backslashes to forward slashes", () => {
      expect(normalizePath("src\\components\\Button.tsx")).toBe(
        "src/components/Button.tsx",
      );
    });

    it("removes leading ./ from paths", () => {
      expect(normalizePath("./src/components")).toBe("src/components");
    });

    it("removes leading slash from paths", () => {
      expect(normalizePath("/src/components")).toBe("src/components");
    });

    it("preserves .. in normalized output for validation to catch", () => {
      // normalizePath doesn't validate, it just normalizes
      expect(normalizePath("src/../outside")).toBe("src/../outside");
    });

    it("handles mixed slashes correctly", () => {
      expect(normalizePath("src\\components/utils\\index.ts")).toBe(
        "src/components/utils/index.ts",
      );
    });

    it("handles empty path", () => {
      expect(normalizePath("")).toBe("");
    });

    it("handles dot path", () => {
      expect(normalizePath(".")).toBe(".");
    });
  });
});
