import { describe, expect, it } from "vitest";

import type { CachedPackFile } from "./content-cache";
import {
  detectFileFormat,
  detectPackFormats,
  getFormatWarning,
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

describe("getFormatWarning", () => {
  it("returns none for single file", () => {
    const warning = getFormatWarning([packFile("rules.md")], "claude");
    expect(warning.type).toBe("none");
  });

  it("returns none when all files match selected format", () => {
    const files = [packFile("CLAUDE.md"), packFile("README/CLAUDE.md")];
    const warning = getFormatWarning(files, "claude");
    expect(warning.type).toBe("none");
  });

  it("shows mixed warning for mixed formats regardless of selection", () => {
    const files = [packFile("CLAUDE.md"), packFile(".cursor/rules/go.mdc")];
    const warning = getFormatWarning(files, "claude");
    expect(warning.type).toBe("mixed");
    expect(warning.message).toContain("multiple formats");
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
