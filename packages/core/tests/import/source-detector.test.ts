import { describe, it, expect } from "vitest";
import {
  detectSourceType,
  parseSourceUrl,
} from "../../src/import/source-detector.js";

describe("detectSourceType", () => {
  it("detects git SSH URLs", () => {
    expect(detectSourceType("git@github.com:org/repo.git")).toBe("git");
    expect(detectSourceType("ssh://git@github.com/org/repo.git")).toBe("git");
  });

  it("detects .git suffix as git", () => {
    expect(detectSourceType("https://example.com/org/repo.git")).toBe("git");
  });

  it("detects known git hosts", () => {
    expect(detectSourceType("https://github.com/org/repo")).toBe("git");
    expect(detectSourceType("https://gitlab.com/org/repo")).toBe("git");
    expect(detectSourceType("https://bitbucket.org/org/repo")).toBe("git");
  });

  it("rejects plain HTTP/HTTPS URLs with helpful error", () => {
    expect(() => detectSourceType("https://example.com/rules.yaml")).toThrow(
      /Plain HTTP\/HTTPS URLs are not supported/,
    );
    expect(() => detectSourceType("http://example.com/rules.md")).toThrow(
      /Plain HTTP\/HTTPS URLs are not supported/,
    );
  });

  it("detects local paths", () => {
    expect(detectSourceType("./path/to/rules")).toBe("local");
    expect(detectSourceType("../parent/rules")).toBe("local");
    expect(detectSourceType("/absolute/path")).toBe("local");
    expect(detectSourceType("relative/path")).toBe("local");
  });
});

describe("parseSourceUrl", () => {
  describe("local paths", () => {
    it("parses relative paths", () => {
      const result = parseSourceUrl("./path/to/rules");
      expect(result.type).toBe("local");
      expect(result.url).toBe("./path/to/rules");
      expect(result.isDirectory).toBe(true);
    });

    it("detects files by extension", () => {
      const result = parseSourceUrl("./path/to/rules.md");
      expect(result.type).toBe("local");
      expect(result.isDirectory).toBe(false);
    });
  });

  describe("git URLs", () => {
    it("parses simple GitHub URL", () => {
      const result = parseSourceUrl("https://github.com/org/repo");
      expect(result.type).toBe("git");
      expect(result.url).toBe("https://github.com/org/repo");
      expect(result.ref).toBeUndefined();
      expect(result.path).toBeUndefined();
      expect(result.isDirectory).toBe(true);
    });

    it("parses GitHub URL with path", () => {
      const result = parseSourceUrl(
        "https://github.com/org/repo/path/to/rules",
      );
      expect(result.type).toBe("git");
      expect(result.url).toBe("https://github.com/org/repo");
      expect(result.path).toBe("path/to/rules");
      expect(result.isDirectory).toBe(true);
    });

    it("parses GitHub URL with file path", () => {
      const result = parseSourceUrl(
        "https://github.com/org/repo/path/to/rule.md",
      );
      expect(result.type).toBe("git");
      expect(result.url).toBe("https://github.com/org/repo");
      expect(result.path).toBe("path/to/rule.md");
      expect(result.isDirectory).toBe(false);
    });

    it("parses SSH URL", () => {
      const result = parseSourceUrl("git@github.com:org/repo.git");
      expect(result.type).toBe("git");
      expect(result.url).toBe("git@github.com:org/repo.git");
      expect(result.isDirectory).toBe(true);
    });
  });

  describe("HTTP URLs", () => {
    it("rejects plain HTTP URLs with helpful error", () => {
      expect(() => parseSourceUrl("https://example.com/rules")).toThrow(
        /Plain HTTP\/HTTPS URLs are not supported/,
      );
    });

    it("rejects plain HTTP URLs with file extension", () => {
      expect(() => parseSourceUrl("https://example.com/rules.md")).toThrow(
        /Plain HTTP\/HTTPS URLs are not supported/,
      );
    });
  });
});
