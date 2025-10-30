import { describe, it, expect } from "vitest";
import { parseMarkdown, validateSingleBlockPerSection } from "../src/parser.js";

describe("parseMarkdown", () => {
  it("extracts single fenced block with guidance", () => {
    const markdown = `# Testing Rules

All features should have tests.

\`\`\`aligntrue
id: test-rule
version: 1.0.0
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      content: "id: test-rule\nversion: 1.0.0",
      startLine: 5,
      endLine: 8,
      sectionTitle: "Testing Rules",
      guidanceBefore: "All features should have tests.",
    });
  });

  it("extracts multiple blocks from different sections", () => {
    const markdown = `## Section 1

First section guidance.

\`\`\`aligntrue
id: rule-1
\`\`\`

## Section 2

Second section guidance.

\`\`\`aligntrue
id: rule-2
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]?.sectionTitle).toBe("Section 1");
    expect(result.blocks[1]?.sectionTitle).toBe("Section 2");
  });

  it("fails on multiple blocks in same section", () => {
    const markdown = `## Testing

First block.

\`\`\`aligntrue
id: rule-1
\`\`\`

Second block in same section.

\`\`\`aligntrue
id: rule-2
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.blocks).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("contains 2 aligntrue blocks");
  });

  it("captures section titles from headers", () => {
    const markdown = `# Main Title

\`\`\`aligntrue
id: main-rule
\`\`\`

## Subsection

\`\`\`aligntrue
id: sub-rule
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks[0]?.sectionTitle).toBe("Main Title");
    expect(result.blocks[1]?.sectionTitle).toBe("Subsection");
  });

  it("handles empty blocks", () => {
    const markdown = `## Empty Rule

\`\`\`aligntrue
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.content).toBe("");
  });

  it("handles blocks with no guidance", () => {
    const markdown = `## Rules

\`\`\`aligntrue
id: rule-1
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.guidanceBefore).toBeUndefined();
  });

  it("ignores non-aligntrue fenced blocks", () => {
    const markdown = `## Code

\`\`\`typescript
const x = 1;
\`\`\`

\`\`\`aligntrue
id: rule-1
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.content).toBe("id: rule-1");
  });

  it("handles nested content in fenced blocks", () => {
    const markdown = `## Rules

\`\`\`aligntrue
id: rule-1
guidance: |
  Multi-line guidance
  with indentation
  and nested content
\`\`\`
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.content).toContain("Multi-line guidance");
  });

  it("detects unclosed fenced blocks", () => {
    const markdown = `## Rules

\`\`\`aligntrue
id: rule-1
version: 1.0.0
`;
    const result = parseMarkdown(markdown);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("Unclosed");
  });

  it("normalizes line endings", () => {
    const markdownCRLF =
      "## Rules\r\n\r\n\`\`\`aligntrue\r\nid: rule-1\r\n\`\`\`";
    const markdownCR = "## Rules\r\r\`\`\`aligntrue\rid: rule-1\r\`\`\`";

    const resultCRLF = parseMarkdown(markdownCRLF);
    const resultCR = parseMarkdown(markdownCR);

    expect(resultCRLF.errors).toEqual([]);
    expect(resultCR.errors).toEqual([]);
    expect(resultCRLF.blocks).toHaveLength(1);
    expect(resultCR.blocks).toHaveLength(1);
  });
});

describe("validateSingleBlockPerSection", () => {
  it("passes with single block per section", () => {
    const blocks = [
      { content: "", startLine: 1, endLine: 3, sectionTitle: "Section 1" },
      { content: "", startLine: 5, endLine: 7, sectionTitle: "Section 2" },
    ];

    const result = validateSingleBlockPerSection(blocks);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails with multiple blocks in same section", () => {
    const blocks = [
      { content: "", startLine: 1, endLine: 3, sectionTitle: "Testing" },
      { content: "", startLine: 5, endLine: 7, sectionTitle: "Testing" },
    ];

    const result = validateSingleBlockPerSection(blocks);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("contains 2 aligntrue blocks");
  });

  it("handles blocks with no section", () => {
    const blocks = [
      { content: "", startLine: 1, endLine: 3 },
      { content: "", startLine: 5, endLine: 7 },
    ];

    const result = validateSingleBlockPerSection(blocks);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain("(no section)");
  });
});
