import { describe, expect, it } from "vitest";
import {
  alignIdFromNormalizedUrl,
  githubBlobToRawUrl,
  normalizeGitUrl,
} from "./normalize";

describe("normalizeGitUrl", () => {
  it("normalizes GitHub blob URLs", () => {
    const input = "https://github.com/org/repo/blob/main/path/to/file.md";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: "https://github.com/org/repo/blob/main/path/to/file.md",
    });
  });

  it("normalizes GitHub raw URLs to blob", () => {
    const input =
      "https://raw.githubusercontent.com/org/repo/main/path/to/file.md";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: "https://github.com/org/repo/blob/main/path/to/file.md",
    });
  });

  it("returns unknown for invalid URLs", () => {
    const result = normalizeGitUrl("not a url");
    expect(result).toEqual({ provider: "unknown", normalizedUrl: null });
  });

  it("returns unknown for non-GitHub URLs", () => {
    const result = normalizeGitUrl(
      "https://gitlab.com/org/repo/blob/main/file.md",
    );
    expect(result).toEqual({ provider: "unknown", normalizedUrl: null });
  });
});

describe("alignIdFromNormalizedUrl", () => {
  it("returns an 11-character URL-safe string", () => {
    const id = alignIdFromNormalizedUrl(
      "https://github.com/org/repo/blob/main/file.md",
    );
    expect(id).toHaveLength(11);
    expect(id).not.toMatch(/[+/=]/);
  });

  it("is deterministic for the same input", () => {
    const url = "https://github.com/org/repo/blob/main/file.md";
    const id1 = alignIdFromNormalizedUrl(url);
    const id2 = alignIdFromNormalizedUrl(url);
    expect(id1).toBe(id2);
  });
});

describe("githubBlobToRawUrl", () => {
  it("converts a valid blob URL to raw", () => {
    const raw = githubBlobToRawUrl(
      "https://github.com/org/repo/blob/main/path/to/file.md",
    );
    expect(raw).toBe(
      "https://raw.githubusercontent.com/org/repo/main/path/to/file.md",
    );
  });

  it("returns null for invalid URLs", () => {
    const raw = githubBlobToRawUrl("https://example.com/not/blob");
    expect(raw).toBeNull();
  });
});
