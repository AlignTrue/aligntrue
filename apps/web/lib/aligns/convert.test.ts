import matter from "gray-matter";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { convertContent, SUPPORTED_AGENT_IDS, type AgentId } from "./convert";

const baseContent = `---
title: Test Title
description: Test Description
globs:
  - "**/*.ts"
---

# Heading

Body text.
`;

function parseFrontmatter(text: string) {
  return matter(text, {
    engines: {
      yaml: (s: string) => yaml.load(s) as Record<string, unknown>,
    },
  });
}

describe("convertContent", () => {
  it("preserves minimal frontmatter for all-agents export", () => {
    const result = convertContent(baseContent, "all");
    const parsed = parseFrontmatter(result.text);

    expect(result.filename).toBe("AGENTS.md");
    expect(result.extension).toBe("md");
    expect(parsed.data).toEqual({
      title: "Test Title",
      description: "Test Description",
    });
    expect(parsed.content.trim()).toContain("Body text.");
  });

  it("applies cursor-specific defaults and keeps globs", () => {
    const result = convertContent(baseContent, "cursor");
    const parsed = parseFrontmatter(result.text);

    expect(result.filename).toBe("rules.mdc");
    expect(result.extension).toBe("mdc");
    expect(parsed.data.description).toBe("Test Description"); // uses description when present
    expect(parsed.data.globs).toEqual(["**/*.ts"]);
    expect(parsed.data.alwaysApply).toBe(true);
  });

  it("uses cursor override metadata when provided", () => {
    const contentWithCursor = `---
title: Overrides
cursor:
  description: Cursor specific
  alwaysApply: false
  globs:
    - "src/**/*.ts"
---

Body
`;
    const result = convertContent(contentWithCursor, "cursor");
    const parsed = parseFrontmatter(result.text);

    expect(parsed.data.description).toBe("Cursor specific");
    expect(parsed.data.globs).toEqual(["src/**/*.ts"]);
    expect(parsed.data.alwaysApply).toBe(false);
  });

  it("maps supported agents to expected filenames", () => {
    const expectations: Record<AgentId, string> = {
      all: "AGENTS.md",
      cursor: "rules.mdc",
      claude: "CLAUDE.md",
      windsurf: "WINDSURF.md",
      copilot: "AGENTS.md",
      gemini: "GEMINI.md",
      zed: "ZED.md",
      warp: "WARP.md",
      cline: "rules.md",
      augmentcode: "rules.md",
      amazonq: "rules.md",
      openhands: "rules.md",
      antigravity: "rules.md",
      kiro: "rules.md",
    };

    for (const agent of SUPPORTED_AGENT_IDS) {
      const result = convertContent(baseContent, agent);
      expect(result.filename).toBe(expectations[agent]);
      expect(result.text.length).toBeGreaterThan(0);
    }
  });
});
