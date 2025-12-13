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
      kind: "single",
      owner: "org",
      repo: "repo",
      ref: "main",
      path: "path/to/file.md",
    });
  });

  it("normalizes GitHub raw URLs to blob", () => {
    const input =
      "https://raw.githubusercontent.com/org/repo/main/path/to/file.md";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: "https://github.com/org/repo/blob/main/path/to/file.md",
      kind: "single",
      owner: "org",
      repo: "repo",
      ref: "main",
      path: "path/to/file.md",
    });
  });

  it("returns unknown for invalid URLs", () => {
    const result = normalizeGitUrl("not a url");
    expect(result).toEqual({
      provider: "unknown",
      normalizedUrl: null,
      kind: "unknown",
    });
  });

  it("returns unknown for non-GitHub URLs", () => {
    const result = normalizeGitUrl(
      "https://gitlab.com/org/repo/blob/main/file.md",
    );
    expect(result).toEqual({
      provider: "unknown",
      normalizedUrl: null,
      kind: "unknown",
    });
  });

  it("normalizes GitHub gist URLs", () => {
    const input = "https://gist.github.com/user/abc123";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: "https://gist.github.com/user/abc123",
      kind: "gist",
      owner: "user",
      gistId: "abc123",
      filename: null,
      revision: null,
    });
  });

  it("normalizes GitHub gist URLs with file fragment", () => {
    const input = "https://gist.github.com/user/abc123#file-cursor_rule.xml";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: "https://gist.github.com/user/abc123",
      kind: "gist",
      owner: "user",
      gistId: "abc123",
      filename: "cursor_rule.xml",
      revision: null,
    });
  });

  it("ignores non-file fragments for gist URLs", () => {
    const input = "https://gist.github.com/user/abc123#random-fragment";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: "https://gist.github.com/user/abc123",
      kind: "gist",
      owner: "user",
      gistId: "abc123",
      filename: null,
      revision: null,
    });
  });

  it("normalizes raw gist URLs", () => {
    const input =
      "https://gist.githubusercontent.com/user/abc123/raw/abcd1234/cursor_rule.xml";
    const result = normalizeGitUrl(input);
    expect(result).toEqual({
      provider: "github",
      normalizedUrl: input,
      kind: "gist",
      owner: "user",
      gistId: "abc123",
      filename: "cursor_rule.xml",
      revision: "abcd1234",
    });
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

  it("returns gist raw URLs as-is", () => {
    const raw = githubBlobToRawUrl(
      "https://gist.githubusercontent.com/user/abc/raw/123/file.md",
    );
    expect(raw).toBe(
      "https://gist.githubusercontent.com/user/abc/raw/123/file.md",
    );
  });

  it("returns raw.githubusercontent.com URLs as-is", () => {
    const raw = githubBlobToRawUrl(
      "https://raw.githubusercontent.com/org/repo/main/path/to/file.md",
    );
    expect(raw).toBe(
      "https://raw.githubusercontent.com/org/repo/main/path/to/file.md",
    );
  });
});
