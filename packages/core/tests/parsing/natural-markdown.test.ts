/**
 * Tests for natural markdown parsing
 */

import { describe, it, expect } from "vitest";
import {
  parseNaturalMarkdown,
  generateNaturalMarkdown,
  isNaturalMarkdown,
} from "../../src/parsing/natural-markdown.js";

describe("parseNaturalMarkdown", () => {
  it("parses markdown without frontmatter", () => {
    const markdown = `
## Testing

Run tests before commit.

## Security

Never commit secrets.
`;

    const result = parseNaturalMarkdown(markdown, "my-project");
    expect(result.metadata.id).toBe("my-project");
    expect(result.metadata.version).toBe("1.0.0");
    expect(result.sections).toHaveLength(2);
  });

  it("parses markdown with YAML frontmatter", () => {
    const markdown = `---
id: packs/typescript
version: 2.1.0
tags: [typescript, quality]
---

## TypeScript Standards

Use strict mode.
`;

    const result = parseNaturalMarkdown(markdown);
    expect(result.metadata.id).toBe("packs/typescript");
    expect(result.metadata.version).toBe("2.1.0");
    expect(result.metadata.tags).toEqual(["typescript", "quality"]);
    expect(result.sections).toHaveLength(1);
  });

  it("preserves preamble content", () => {
    const markdown = `
Introduction text here.

## First Section

Content.
`;

    const result = parseNaturalMarkdown(markdown);
    expect(result.preamble).toContain("Introduction text");
    expect(result.sections).toHaveLength(1);
  });

  it("handles all metadata fields", () => {
    const markdown = `---
id: my-pack
version: 1.2.3
summary: A test pack
tags: [test]
owner: myorg
source: https://github.com/myorg/rules
source_sha: abc123
---

## Section

Content.
`;

    const result = parseNaturalMarkdown(markdown);
    expect(result.metadata.id).toBe("my-pack");
    expect(result.metadata.version).toBe("1.2.3");
    expect(result.metadata.summary).toBe("A test pack");
    expect(result.metadata.owner).toBe("myorg");
    expect(result.metadata.source).toContain("github.com");
    expect(result.metadata.source_sha).toBe("abc123");
  });

  it("reports errors for invalid frontmatter", () => {
    const markdown = `---
invalid: yaml: syntax:
---

## Section

Content.
`;

    const result = parseNaturalMarkdown(markdown);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.level).toBe("error");
    expect(result.errors[0]!.message).toContain("frontmatter");
  });

  it("merges extraction errors with parse errors", () => {
    const markdown = `---
id: test-pack
---

## Testing

Content.

## Testing

Duplicate heading.
`;

    const result = parseNaturalMarkdown(markdown);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes("Duplicate"))).toBe(
      true,
    );
  });
});

describe("generateNaturalMarkdown", () => {
  it("generates markdown without frontmatter for defaults", () => {
    const sections = [
      {
        heading: "Testing",
        level: 2,
        content: "Run tests.",
        fingerprint: "testing-abc123",
        lineStart: 1,
        lineEnd: 3,
      },
    ];

    const markdown = generateNaturalMarkdown(
      { id: "unnamed-pack", version: "1.0.0" },
      sections,
    );

    expect(markdown).not.toContain("---");
    expect(markdown).toContain("## Testing");
    expect(markdown).toContain("Run tests.");
  });

  it("generates markdown with frontmatter for custom metadata", () => {
    const sections = [
      {
        heading: "Testing",
        level: 2,
        content: "Run tests.",
        fingerprint: "testing-abc123",
        lineStart: 1,
        lineEnd: 3,
      },
    ];

    const markdown = generateNaturalMarkdown(
      {
        id: "packs/typescript",
        version: "2.0.0",
        tags: ["typescript"],
      },
      sections,
    );

    expect(markdown).toContain("---");
    expect(markdown).toContain("id: packs/typescript");
    expect(markdown).toContain("version: 2.0.0");
    expect(markdown).toContain("## Testing");
  });

  it("includes preamble when provided", () => {
    const sections = [
      {
        heading: "Testing",
        level: 2,
        content: "Run tests.",
        fingerprint: "testing-abc123",
        lineStart: 1,
        lineEnd: 3,
      },
    ];

    const markdown = generateNaturalMarkdown(
      { id: "my-pack", version: "1.0.0" },
      sections,
      { preamble: "Introduction text." },
    );

    expect(markdown).toContain("Introduction text.");
    expect(markdown).toContain("## Testing");
  });

  it("handles multiple sections with different levels", () => {
    const sections = [
      {
        heading: "Parent",
        level: 2,
        content: "Parent content.",
        fingerprint: "parent-abc123",
        lineStart: 1,
        lineEnd: 3,
      },
      {
        heading: "Child",
        level: 3,
        content: "Child content.",
        fingerprint: "child-def456",
        lineStart: 4,
        lineEnd: 6,
      },
    ];

    const markdown = generateNaturalMarkdown(
      { id: "test", version: "1.0.0" },
      sections,
    );

    expect(markdown).toContain("## Parent");
    expect(markdown).toContain("### Child");
  });

  it("adds proper spacing between sections", () => {
    const sections = [
      {
        heading: "Section 1",
        level: 2,
        content: "Content 1.",
        fingerprint: "section-1-abc",
        lineStart: 1,
        lineEnd: 3,
      },
      {
        heading: "Section 2",
        level: 2,
        content: "Content 2.",
        fingerprint: "section-2-def",
        lineStart: 4,
        lineEnd: 6,
      },
    ];

    const markdown = generateNaturalMarkdown(
      { id: "test", version: "1.0.0" },
      sections,
    );

    // Should have blank lines between sections
    const lines = markdown.split("\n");
    const section1Index = lines.findIndex((l) => l === "## Section 1");
    const section2Index = lines.findIndex((l) => l === "## Section 2");

    expect(section2Index - section1Index).toBeGreaterThan(2);
  });

  it("round-trips correctly", () => {
    const original = `---
id: test-pack
version: 1.5.0
---

## Testing

Run all tests before committing.

## Security

Never commit secrets or API keys.
`;

    const parsed = parseNaturalMarkdown(original);
    const regenerated = generateNaturalMarkdown(
      parsed.metadata,
      parsed.sections,
      { includeFrontmatter: true },
    );
    const reparsed = parseNaturalMarkdown(regenerated);

    expect(reparsed.metadata.id).toBe(parsed.metadata.id);
    expect(reparsed.sections).toHaveLength(parsed.sections.length);
    expect(reparsed.sections[0]!.heading).toBe(parsed.sections[0]!.heading);
  });
});

describe("isNaturalMarkdown", () => {
  it("detects natural markdown format", () => {
    const markdown = `
## Testing

Run tests.
`;
    expect(isNaturalMarkdown(markdown)).toBe(true);
  });

  it("detects legacy fenced block format", () => {
    const markdown = `
\`\`\`aligntrue
id: test
sections:
  - id: testing
\`\`\`
`;
    expect(isNaturalMarkdown(markdown)).toBe(false);
  });

  it("returns true for markdown with frontmatter and sections", () => {
    const markdown = `---
id: test
---

## Section

Content.
`;
    expect(isNaturalMarkdown(markdown)).toBe(true);
  });

  it("returns false for markdown without headings", () => {
    const markdown = "Just plain text without any headings.";
    expect(isNaturalMarkdown(markdown)).toBe(false);
  });
});
