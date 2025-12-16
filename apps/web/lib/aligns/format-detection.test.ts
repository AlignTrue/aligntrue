import { describe, expect, it } from "vitest";

import type { CachedPackFile } from "./content-cache";
import {
  detectFileFormat,
  detectPackFormats,
  isMixedPack,
} from "./format-detection";

function packFile(path: string, content = "content"): CachedPackFile {
  return { path, size: content.length, content };
}

describe("detectFileFormat", () => {
  it("detects exact filenames", () => {
    expect(detectFileFormat("CLAUDE.md")).toBe("claude");
    expect(detectFileFormat("AGENTS.md")).toBe("all");
  });

  it("detects cursor by extension and path", () => {
    expect(detectFileFormat("rules.mdc")).toBe("cursor");
    expect(detectFileFormat(".cursor/rules/go.mdc")).toBe("cursor");
  });

  it("detects cline by legacy filename", () => {
    expect(detectFileFormat(".clinerules")).toBe("cline");
  });

  it("falls back to generic markdown", () => {
    expect(detectFileFormat("rules.md")).toBe("all");
  });
});

describe("isMixedPack", () => {
  it("returns false for single file", () => {
    expect(isMixedPack([packFile("rules.md")])).toBe(false);
  });

  it("returns false when formats are consistent", () => {
    const files = [packFile("CLAUDE.md"), packFile("README/CLAUDE.md")];
    expect(isMixedPack(files)).toBe(false);
  });

  it("returns true when formats differ", () => {
    const files = [packFile("CLAUDE.md"), packFile(".cursor/rules/go.mdc")];
    expect(isMixedPack(files)).toBe(true);
  });
});

describe("detectPackFormats", () => {
  it("collects unique detected formats", () => {
    const files = [
      packFile("CLAUDE.md"),
      packFile(".cursor/rules/go.mdc"),
      packFile("AGENTS.md"),
    ];
    const formats = detectPackFormats(files);
    expect(Array.from(formats).sort()).toEqual(["all", "claude", "cursor"]);
  });
});
