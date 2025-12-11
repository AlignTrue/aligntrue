import { describe, expect, it } from "vitest";

import { filenameFromUrl, parseGitHubUrl } from "./urlUtils";

describe("parseGitHubUrl", () => {
  it("extracts owner, repo, and ownerUrl from a GitHub URL", () => {
    const result = parseGitHubUrl(
      "https://github.com/AlignTrue/aligntrue/blob/main/README.md",
    );

    expect(result.owner).toBe("@AlignTrue");
    expect(result.repo).toBe("aligntrue");
    expect(result.ownerUrl).toBe("https://github.com/AlignTrue");
  });

  it("falls back to defaults for invalid URLs", () => {
    const result = parseGitHubUrl("not-a-url");

    expect(result.owner).toBe("Unknown");
    expect(result.repo).toBe("unknown");
    expect(result.ownerUrl).toBeNull();
  });

  it("handles URLs without a repo segment", () => {
    const result = parseGitHubUrl("https://github.com/AlignTrue");

    expect(result.owner).toBe("@AlignTrue");
    expect(result.repo).toBe("unknown");
    expect(result.ownerUrl).toBe("https://github.com/AlignTrue");
  });
});

describe("filenameFromUrl", () => {
  it("returns the filename from a GitHub blob URL", () => {
    const name = filenameFromUrl(
      "https://github.com/org/repo/blob/main/rules/align.md",
    );
    expect(name).toBe("align.md");
  });

  it("falls back when URL parsing fails", () => {
    const name = filenameFromUrl("https://example.com/no-file/");
    expect(name).toBe("no-file");
  });

  it("returns default for missing input", () => {
    expect(filenameFromUrl()).toBe("rules.md");
    expect(filenameFromUrl(null)).toBe("rules.md");
  });
});
