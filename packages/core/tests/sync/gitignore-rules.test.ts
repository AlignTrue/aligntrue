import { describe, expect, it } from "vitest";

import type { AlignSection } from "@aligntrue/schema";
import { computeGitignoreRuleExports } from "../../src/sync/gitignore-rules.js";

function section(partial: Partial<AlignSection>): AlignSection {
  return {
    heading: "Test",
    level: 2,
    content: "",
    fingerprint: "abc",
    ...partial,
  };
}

describe("computeGitignoreRuleExports", () => {
  it("returns empty when no gitignored sections", () => {
    const result = computeGitignoreRuleExports([], ["cursor"]);
    expect(result).toEqual([]);
  });

  it("computes cursor export path with nested_location", () => {
    const sections: AlignSection[] = [
      section({
        source_file: ".aligntrue/rules/guardrails.md",
        vendor: {
          aligntrue: {
            frontmatter: { gitignore: true, nested_location: "apps/web" },
          },
        },
      }),
    ];

    const result = computeGitignoreRuleExports(sections, ["cursor"]);
    expect(result).toEqual([
      {
        sourceFile: ".aligntrue/rules/guardrails.md",
        exportPaths: ["apps/web/.cursor/rules/guardrails.mdc"],
      },
    ]);
  });

  it("derives filename from fingerprint when source_file missing", () => {
    const sections: AlignSection[] = [
      section({
        source_file: "",
        fingerprint: "xyz123",
        vendor: { aligntrue: { frontmatter: { gitignore: true } } },
      }),
    ];

    const result = computeGitignoreRuleExports(sections, ["cursor"]);
    expect(result[0]?.exportPaths[0]).toBe(".cursor/rules/xyz123.mdc");
  });

  it("returns empty when exporter not enabled", () => {
    const sections: AlignSection[] = [
      section({
        source_file: ".aligntrue/rules/rule.md",
        vendor: { aligntrue: { frontmatter: { gitignore: true } } },
      }),
    ];

    const result = computeGitignoreRuleExports(sections, ["agents"]);
    expect(result).toEqual([]);
  });
});
