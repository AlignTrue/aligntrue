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
      });
    });

    it("should parse URL with directory path", () => {
      const result = parseSourceURL("https://github.com/company/rules/packs");
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: undefined,
        path: "packs",
        isFile: false,
      });
    });

    it("should parse URL with file path", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules/packs/security.md",
      );
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: undefined,
        path: "packs/security.md",
        isFile: true,
      });
    });

    it("should parse URL with version and file path", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules@v2.0.0/packs/security.md",
      );
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: "v2.0.0",
        path: "packs/security.md",
        isFile: true,
      });
    });

    it("should parse URL with commit SHA", () => {
      const result = parseSourceURL(
        "https://github.com/company/rules@abc123def/packs",
      );
      expect(result).toEqual({
        host: "github.com",
        org: "company",
        repo: "rules",
        ref: "abc123def",
        path: "packs",
        isFile: false,
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
        "https://github.com/company/rules/packs/advanced/security.md",
      );
      expect(result.path).toBe("packs/advanced/security.md");
      expect(result.isFile).toBe(true);
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
