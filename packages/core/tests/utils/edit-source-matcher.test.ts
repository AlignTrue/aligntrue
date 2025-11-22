import { describe, it, expect } from "vitest";
import { matchesEditSource } from "../../src/utils/edit-source-matcher.js";

describe("matchesEditSource", () => {
  it("returns true when no edit_source is configured", () => {
    expect(matchesEditSource("any/path.md", undefined, false)).toBe(true);
  });

  it("returns true in decentralized mode regardless of pattern", () => {
    expect(matchesEditSource("any/path.md", "other.md", true)).toBe(true);
  });

  it("matches exact file path", () => {
    expect(matchesEditSource("AGENTS.md", "AGENTS.md", false)).toBe(true);
    expect(matchesEditSource("other.md", "AGENTS.md", false)).toBe(false);
  });

  it("matches glob patterns", () => {
    expect(
      matchesEditSource(".cursor/rules/test.mdc", ".cursor/rules/*.mdc", false),
    ).toBe(true);
    expect(
      matchesEditSource(
        ".cursor/rules/nested/test.mdc",
        ".cursor/rules/*.mdc",
        false,
      ),
    ).toBe(false);
  });

  it("matches recursive glob patterns", () => {
    expect(matchesEditSource("AGENTS.md", "**/AGENTS.md", false)).toBe(true);
    expect(matchesEditSource("apps/web/AGENTS.md", "**/AGENTS.md", false)).toBe(
      true,
    );
    expect(matchesEditSource("apps/web/OTHER.md", "**/AGENTS.md", false)).toBe(
      false,
    );
  });

  it("matches array of patterns", () => {
    const patterns = ["AGENTS.md", ".cursor/rules/*.mdc"];
    expect(matchesEditSource("AGENTS.md", patterns, false)).toBe(true);
    expect(matchesEditSource(".cursor/rules/test.mdc", patterns, false)).toBe(
      true,
    );
    expect(matchesEditSource("other.md", patterns, false)).toBe(false);
  });

  it("normalizes Windows path separators", () => {
    expect(
      matchesEditSource(
        ".cursor\\rules\\test.mdc",
        ".cursor/rules/*.mdc",
        false,
      ),
    ).toBe(true);
  });

  it("handles scoped paths", () => {
    expect(
      matchesEditSource("apps/web/AGENTS.md", "apps/web/AGENTS.md", false),
    ).toBe(true);
    expect(
      matchesEditSource("apps/api/AGENTS.md", "apps/web/AGENTS.md", false),
    ).toBe(false);
  });
});
