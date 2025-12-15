import { describe, expect, it } from "vitest";

import {
  hasAllowedExtension,
  isDirectoryUrl,
  validateAlignUrl,
  validateAlignUrls,
} from "./url-validation";

describe("hasAllowedExtension", () => {
  it("allows markdown extensions", () => {
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/rule.md"),
    ).toBe(true);
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/rule.mdc"),
    ).toBe(true);
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/rule.mdx"),
    ).toBe(true);
    expect(
      hasAllowedExtension(
        "https://github.com/org/repo/blob/main/rule.markdown",
      ),
    ).toBe(true);
  });

  it("allows xml", () => {
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/rule.xml"),
    ).toBe(true);
  });

  it("allows special agent filenames", () => {
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/.clinerules"),
    ).toBe(true);
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/.cursorrules"),
    ).toBe(true);
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/.goosehints"),
    ).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    expect(
      hasAllowedExtension("https://github.com/org/repo/blob/main/file.txt"),
    ).toBe(false);
  });
});

describe("isDirectoryUrl", () => {
  it("returns true for tree URLs", () => {
    expect(
      isDirectoryUrl("https://github.com/org/repo/tree/main/.cursor/rules"),
    ).toBe(true);
  });

  it("returns false for blob URLs", () => {
    expect(
      isDirectoryUrl("https://github.com/org/repo/blob/main/rule.md"),
    ).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isDirectoryUrl("notaurl")).toBe(false);
  });
});

describe("validateAlignUrl", () => {
  it("rejects empty URL", () => {
    const res = validateAlignUrl("  ");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("empty");
  });

  it("rejects non-github URLs", () => {
    const res = validateAlignUrl("https://example.com/file.md");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("GitHub");
  });

  it("rejects unsupported extensions", () => {
    const res = validateAlignUrl(
      "https://github.com/org/repo/blob/main/file.txt",
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Unsupported file type");
  });

  it("accepts valid github blob URL and extracts owner", () => {
    const res = validateAlignUrl(
      "https://github.com/org/repo/blob/main/rule.md",
    );
    expect(res.valid).toBe(true);
    expect(res.owner).toBe("org");
    expect(res.normalized?.normalizedUrl).toContain("/blob/");
  });

  it("accepts raw URLs by normalizing to blob", () => {
    const res = validateAlignUrl(
      "https://raw.githubusercontent.com/org/repo/main/rule.md",
    );
    expect(res.valid).toBe(true);
    expect(res.normalized?.normalizedUrl).toContain(
      "https://github.com/org/repo/blob/main/rule.md",
    );
  });
});

describe("validateAlignUrls", () => {
  it("deduplicates and flags duplicates", () => {
    const { results, allValid } = validateAlignUrls([
      "https://github.com/org/repo/blob/main/rule.md",
      "https://github.com/org/repo/blob/main/rule.md",
    ]);
    expect(allValid).toBe(false);
    expect(results[1].error).toContain("Duplicate");
  });

  it("collects unique owners", () => {
    const { uniqueOwners } = validateAlignUrls([
      "https://github.com/org1/repo/blob/main/a.md",
      "https://github.com/org2/repo/blob/main/b.md",
    ]);
    expect(uniqueOwners.sort()).toEqual(["org1", "org2"]);
  });

  it("enforces bulk limit", () => {
    const urls = Array.from(
      { length: 55 },
      (_, i) => `https://github.com/org/repo/blob/main/r${i}.md`,
    );
    const { limited, results } = validateAlignUrls(urls);
    expect(limited).toBe(true);
    expect(results).toHaveLength(50);
  });
});
