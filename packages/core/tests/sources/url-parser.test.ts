/**
 * Tests for URL parser
 */

import { describe, it, expect } from "vitest";
import {
  parseSourceURL,
  generateGitCloneURL,
} from "../../src/sources/url-parser.js";

describe("URL Parser", () => {
  describe("parseSourceURL", () => {
    it("should parse basic GitHub URL", () => {
      const result = parseSourceURL("https://github.com/company/rules");
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: undefined,
        path: undefined,
        isFile: false,
        isDirectory: true,
      });
    });

    it("should parse URL with version ref", () => {
      const result = parseSourceURL("https://github.com/company/rules@v2.0.0");
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: "v2.0.0",
        path: undefined,
        isFile: false,
        isDirectory: true,
      });
    });

    it("should parse URL with directory path", () => {
      const result = parseSourceURL("https://github.com/company/rules/aligns");
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: undefined,
        path: "aligns",
        isFile: false,
        isDirectory: true,
      });
    });

    it("should parse URL with file path", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules/aligns/security.md",
      );
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: undefined,
        path: "aligns/security.md",
        isFile: true,
        isDirectory: false,
      });
    });

    it("should parse URL with version and file path", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules@v2.0.0/aligns/security.md",
      );
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: "v2.0.0",
        path: "aligns/security.md",
        isFile: true,
        isDirectory: false,
      });
    });

    it("should parse URL with commit SHA", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules@abc123def/aligns",
      );
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: "abc123def",
        path: "aligns",
        isFile: false,
        isDirectory: true,
      });
    });

    it("should handle .git suffix", () => {
      const result = parseSourceURL("https://github.com/company/rules.git");
      expect(result.repo).toBe("rules");
    });

    it("should parse GitLab URLs", () => {
      const result = parseSourceURL("https://gitlab.com/company/rules");
      expect(result.host).toBe("gitlab.com");
      expect(result.org).toBe("company");
      expect(result.repo).toBe("rules");
    });

    it("should parse markdown extension", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules/README.markdown",
      );
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
    });

    it("should throw on invalid format", () => {
      expect(() => parseSourceURL("github.com/company/rules")).toThrow();
    });

    it("should throw on missing org/repo", () => {
      expect(() => parseSourceURL("https://github.com/company")).toThrow();
    });

    it("should throw on empty string", () => {
      expect(() => parseSourceURL("")).toThrow();
    });

    it("should handle nested paths", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules/aligns/advanced/security.md",
      );
      expect(result.path).toBe("aligns/advanced/security.md");
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
    });

    // GitHub web UI URL format tests
    describe("GitHub web UI URLs", () => {
      it("should parse /tree/main/ directory URL", () => {
        const result = parseSourceURL(
          "https://github.com/company/rules/tree/main/aligns",
        );
        expect(result).toEqual({
          host: "github.com",
          org: "company",
          repo: "rules",
          ref: "main",
          path: "aligns",
          isFile: false,
          isDirectory: true,
        });
      });

      it("should parse /blob/main/ file URL", () => {
        const result = parseSourceURL(
          "https://github.com/company/rules/blob/main/aligns/security.md",
        );
        expect(result).toEqual({
          host: "github.com",
          org: "company",
          repo: "rules",
          ref: "main",
          path: "aligns/security.md",
          isFile: true,
          isDirectory: false,
        });
      });

      it("should parse /tree/ URL with version tag", () => {
        const result = parseSourceURL(
          "https://github.com/company/rules/tree/v1.0.0/aligns",
        );
        expect(result).toEqual({
          host: "github.com",
          org: "company",
          repo: "rules",
          ref: "v1.0.0",
          path: "aligns",
          isFile: false,
          isDirectory: true,
        });
      });

      it("should parse /blob/ URL with commit SHA", () => {
        const result = parseSourceURL(
          "https://github.com/company/rules/blob/abc123def/README.md",
        );
        expect(result).toEqual({
          host: "github.com",
          org: "company",
          repo: "rules",
          ref: "abc123def",
          path: "README.md",
          isFile: true,
          isDirectory: false,
        });
      });

      it("should parse /tree/ URL with nested path", () => {
        const result = parseSourceURL(
          "https://github.com/AlignTrue/examples/tree/main/aligns/testing.md",
        );
        expect(result).toEqual({
          host: "github.com",
          org: "AlignTrue",
          repo: "examples",
          ref: "main",
          path: "aligns/testing.md",
          isFile: true,
          isDirectory: false,
        });
      });

      it("should parse /tree/ URL at repo root (no path)", () => {
        const result = parseSourceURL(
          "https://github.com/company/rules/tree/main",
        );
        expect(result).toEqual({
          host: "github.com",
          org: "company",
          repo: "rules",
          ref: "main",
          path: undefined,
          isFile: false,
          isDirectory: true,
        });
      });

      it("should parse /tree/ URL with branch containing slashes", () => {
        const result = parseSourceURL(
          "https://github.com/company/rules/tree/feature/my-feature/aligns",
        );
        // Note: This is a limitation - branch names with slashes are parsed incorrectly
        // The first part after tree/ is treated as the ref
        expect(result.ref).toBe("feature");
        expect(result.path).toBe("my-feature/aligns");
      });
    });
  });

  describe("generateGitCloneURL", () => {
    it("should generate clone URL", () => {
      const parsed = parseSourceURL("https://github.com/company/rules");
      const cloneURL = generateGitCloneURL(parsed);
      expect(cloneURL).toBe("https://github.com/company/rules.git");
    });
  });
});
