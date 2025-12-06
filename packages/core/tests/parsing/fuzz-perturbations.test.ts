import { describe, it, expect } from "vitest";
import { parseNaturalMarkdown } from "../../src/parsing/natural-markdown.js";

const BASE_MARKDOWN = `---
id: fuzz/base
version: 1.0.0
summary: Base align for perturbation tests
---

## Primary

Keep network calls out of unit tests.
`;

describe("natural markdown parsing - perturbation harness", () => {
  const cases = [
    {
      name: "duplicate frontmatter key",
      markdown: BASE_MARKDOWN.replace(
        "version: 1.0.0",
        "version: 1.0.0\nversion: 2.0.0",
      ),
      expectError: true,
    },
    {
      name: "mis-indented list",
      markdown: `${BASE_MARKDOWN}\n- item\n\t- sub-item\n`,
      expectError: false,
    },
    {
      name: "dangling yaml fragment",
      markdown: `---
id: fuzz/base
version:
  - 1
  key: value
---

## Primary

Keep network calls out of unit tests.
`,
      expectError: true,
    },
    {
      name: "mixed tabs and spaces before headings",
      markdown: `\t \n  \n${BASE_MARKDOWN}`,
      expectError: false,
    },
  ];

  for (const testCase of cases) {
    it(`handles ${testCase.name}`, () => {
      const result = parseNaturalMarkdown(testCase.markdown, "fuzz-scope");

      if (testCase.expectError) {
        expect(result.errors.some((e) => e.level === "error")).toBe(true);
      } else {
        expect(result.errors.filter((e) => e.level === "error")).toHaveLength(
          0,
        );
        expect(result.sections.length).toBeGreaterThan(0);
      }

      // Ensure we never silently drop all sections
      expect(result.sections.length).toBeGreaterThan(0);
    });
  }
});
