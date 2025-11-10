/**
 * Tests for section extraction from markdown
 */

import { describe, it, expect } from "vitest";
import {
  extractSections,
  filterSectionsByLevel,
  groupSectionsByParent,
} from "../../src/parsing/section-extractor.js";

describe("extractSections", () => {
  it("extracts simple sections from markdown", () => {
    const markdown = `
## Testing

Run tests before committing.

## Security

Never commit secrets.
`;

    const result = extractSections(markdown);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]!.heading).toBe("Testing");
    expect(result.sections[0]!.level).toBe(2);
    expect(result.sections[0]!.content).toContain("Run tests");
    expect(result.sections[1]!.heading).toBe("Security");
  });

  it("handles nested sections with different levels", () => {
    const markdown = `
## Parent Section

Parent content.

### Child Section

Child content.

## Another Parent

More content.
`;

    const result = extractSections(markdown);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0]!.level).toBe(2);
    expect(result.sections[1]!.level).toBe(3);
    expect(result.sections[2]!.level).toBe(2);
  });

  it("generates fingerprints for each section", () => {
    const markdown = `
## Testing

Run tests.
`;

    const result = extractSections(markdown);
    expect(result.sections[0]!.fingerprint).toMatch(/^testing-[a-f0-9]{6}$/);
  });

  it("tracks line numbers correctly", () => {
    const markdown = `## First
Content
## Second
More content`;

    const result = extractSections(markdown);
    expect(result.sections[0]!.lineStart).toBe(1);
    expect(result.sections[0]!.lineEnd).toBe(2);
    expect(result.sections[1]!.lineStart).toBe(3);
    expect(result.sections[1]!.lineEnd).toBe(4);
  });

  it("handles content before first heading as preamble", () => {
    const markdown = `
This is introduction text.

Some more preamble.

## First Section

Section content.
`;

    const result = extractSections(markdown);
    expect(result.preamble).toContain("introduction text");
    expect(result.preamble).toContain("more preamble");
    expect(result.sections).toHaveLength(1);
  });

  it("ignores # level-1 headings (document title)", () => {
    const markdown = `
# Document Title

## Actual Section

Content here.
`;

    const result = extractSections(markdown);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]!.heading).toBe("Actual Section");
    expect(result.preamble).toContain("Document Title");
  });

  it("handles code blocks without false heading detection", () => {
    const markdown = `
## Code Example

Here's some code:

\`\`\`javascript
// ## This is not a heading
function test() {
  return "## Also not a heading";
}
\`\`\`

Real content continues.
`;

    const result = extractSections(markdown);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]!.heading).toBe("Code Example");
    expect(result.sections[0]!.content).toContain("## This is not a heading");
    expect(result.sections[0]!.content).toContain("Real content continues");
  });

  it("handles empty sections", () => {
    const markdown = `
## Empty Section

## Another Section

Some content.
`;

    const result = extractSections(markdown);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]!.content).toBe("");
    expect(result.sections[1]!.content).toContain("Some content");
  });

  it("warns about duplicate headings", () => {
    const markdown = `
## Testing

First testing section.

## Testing

Second testing section.
`;

    const result = extractSections(markdown);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.level).toBe("warn");
    expect(result.errors[0]!.message).toContain("Duplicate heading");
  });

  it("extracts explicit IDs from HTML comments", () => {
    const markdown = `
## Testing

<!-- aligntrue-id: custom-test-id -->

Run tests before commit.
`;

    const result = extractSections(markdown);
    expect(result.sections[0]!.explicitId).toBe("custom-test-id");
    expect(result.sections[0]!.fingerprint).toBe("custom-test-id");
  });

  it("handles various line ending formats", () => {
    const variants = [
      "## Section\nContent\n## Another\nMore",
      "## Section\r\nContent\r\n## Another\r\nMore",
      "## Section\rContent\r## Another\rMore",
    ];

    for (const markdown of variants) {
      const result = extractSections(markdown);
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0]!.heading).toBe("Section");
      expect(result.sections[1]!.heading).toBe("Another");
    }
  });

  it("handles headings with special characters", () => {
    const markdown = `
## API: REST vs. GraphQL

Choose based on use case.

## Testing & Deployment

Combined practices.
`;

    const result = extractSections(markdown);
    expect(result.sections[0]!.heading).toBe("API: REST vs. GraphQL");
    expect(result.sections[1]!.heading).toBe("Testing & Deployment");
  });
});

describe("filterSectionsByLevel", () => {
  it("filters sections by level", () => {
    const markdown = `
## Level 2A
### Level 3
## Level 2B
`;

    const result = extractSections(markdown);
    const level2 = filterSectionsByLevel(result.sections, 2);
    const level3 = filterSectionsByLevel(result.sections, 3);

    expect(level2).toHaveLength(2);
    expect(level3).toHaveLength(1);
  });
});

describe("groupSectionsByParent", () => {
  it("groups child sections under parent headings", () => {
    const markdown = `
## Parent 1
### Child 1A
### Child 1B
## Parent 2
### Child 2A
`;

    const result = extractSections(markdown);
    const groups = groupSectionsByParent(result.sections);

    expect(groups.size).toBe(2);
    expect(groups.get("Parent 1")).toHaveLength(2);
    expect(groups.get("Parent 2")).toHaveLength(1);
  });

  it("handles sections without children", () => {
    const markdown = `
## Parent 1
## Parent 2
### Child 2A
`;

    const result = extractSections(markdown);
    const groups = groupSectionsByParent(result.sections);

    expect(groups.get("Parent 1")).toHaveLength(0);
    expect(groups.get("Parent 2")).toHaveLength(1);
  });
});
