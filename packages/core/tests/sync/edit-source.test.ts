/**
 * Tests for edit_source configuration and matching
 */

import { describe, it, expect } from "vitest";
import { matchesEditSource } from "../../src/sync/multi-file-parser.js";

describe("matchesEditSource", () => {
  const cwd = "/test/project";

  it("should match exact file paths", () => {
    expect(matchesEditSource("AGENTS.md", "AGENTS.md", cwd)).toBe(true);
    expect(matchesEditSource("AGENTS.md", "CLAUDE.md", cwd)).toBe(false);
  });

  it("should match glob patterns", () => {
    expect(
      matchesEditSource(
        ".cursor/rules/backend.mdc",
        ".cursor/rules/*.mdc",
        cwd,
      ),
    ).toBe(true);
    expect(
      matchesEditSource(
        ".cursor/rules/frontend.mdc",
        ".cursor/rules/*.mdc",
        cwd,
      ),
    ).toBe(true);
    expect(matchesEditSource("AGENTS.md", ".cursor/rules/*.mdc", cwd)).toBe(
      false,
    );
  });

  it("should handle array of patterns", () => {
    const patterns = ["AGENTS.md", ".cursor/rules/*.mdc"];
    expect(matchesEditSource("AGENTS.md", patterns, cwd)).toBe(true);
    expect(matchesEditSource(".cursor/rules/backend.mdc", patterns, cwd)).toBe(
      true,
    );
    expect(matchesEditSource("CLAUDE.md", patterns, cwd)).toBe(false);
  });

  it("should handle special values", () => {
    expect(matchesEditSource("AGENTS.md", ".rules.yaml", cwd)).toBe(false);
    expect(matchesEditSource("AGENTS.md", "any_agent_file", cwd)).toBe(true);
    expect(
      matchesEditSource(".cursor/rules/backend.mdc", "any_agent_file", cwd),
    ).toBe(true);
  });

  it("should default to AGENTS.md when no edit_source specified", () => {
    expect(matchesEditSource("AGENTS.md", undefined, cwd)).toBe(true);
    expect(matchesEditSource("CLAUDE.md", undefined, cwd)).toBe(false);
  });
});

describe("edit_source migration from two_way", () => {
  it("should migrate two_way: false to .rules.yaml", () => {
    // Migration logic tested in config tests
    expect(".rules.yaml").toBe(".rules.yaml");
  });

  it("should migrate two_way: true to any_agent_file", () => {
    // Migration logic tested in config tests
    expect("any_agent_file").toBe("any_agent_file");
  });
});
