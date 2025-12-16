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
  it("falls back on malformed frontmatter", () => {
    const malformed = `---
globs: **/*.templ
---
Body text.`;

    const result = convertContent(malformed, "cursor");
    const parsed = parseFrontmatter(result.text);

    // Should not throw and should preserve body
    expect(parsed.data).toEqual({
      description: "AlignTrue rules for Cursor", // default cursor description fallback
      alwaysApply: true,
    });
    expect(parsed.content.trim()).toContain("Body text.");
  });

  it("strips malformed frontmatter from body", () => {
    const malformed = `---
globs: **/*.templ
---
Body text.`;

    const result = convertContent(malformed, "cursor");
    expect(result.text).not.toContain("globs: **/*.templ");
    expect(result.text).toContain("Body text.");
  });

  it("handles missing closing fence gracefully", () => {
    const noClosing = `---
key: value
Body text without closing fence.`;

    const result = convertContent(noClosing, "cursor");
    expect(result.text).toContain("description: AlignTrue rules for Cursor");
  });

  it("passes through AlignTrue format with full frontmatter", () => {
    const result = convertContent(baseContent, "aligntrue");
    const parsed = parseFrontmatter(result.text);

    expect(result.filename).toBe("rules.md");
    expect(result.extension).toBe("md");
    expect(parsed.data).toEqual({
      title: "Test Title",
      description: "Test Description",
      globs: ["**/*.ts"],
    });
    expect(parsed.content.trim()).toContain("Body text.");
  });

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

  it("maps apply_to to cursor alwaysApply", () => {
    const contentWithApplyTo = `---
title: Apply Mapping
apply_to: agent_requested
---

Body
`;
    const result = convertContent(contentWithApplyTo, "cursor");
    const parsed = parseFrontmatter(result.text);
    expect(parsed.data.alwaysApply).toBe(false);
  });

  it("uses align-md defaults for the default agent", () => {
    const result = convertContent(baseContent, "default");
    const parsed = parseFrontmatter(result.text);

    expect(result.filename).toBe("align.md");
    expect(result.extension).toBe("md");
    expect(parsed.data).toEqual({
      title: "Test Title",
      description: "Test Description",
      globs: ["**/*.ts"],
    });
    expect(parsed.content.trim()).toContain("Body text.");
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
      default: "align.md",
      original: "rules.md",
      aligntrue: "rules.md",
      all: "AGENTS.md",
      copilot: "AGENTS.md",
      cursor: "rules.mdc",
      claude: "CLAUDE.md",
      windsurf: "WINDSURF.md",
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
