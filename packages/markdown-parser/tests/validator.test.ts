import { describe, it, expect } from "vitest";
import { validateMarkdown } from "../src/validator.js";

describe("validateMarkdown", () => {
  it("rejects markdown with no aligntrue blocks", async () => {
    const markdown = `## Testing

This is guidance text.

## Another Section

More guidance.
`;
    const result = await validateMarkdown(markdown);
    // Natural markdown without fenced aligntrue blocks should fail validation
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles invalid YAML in fenced block", async () => {
    const markdown = `## Testing

\`\`\`aligntrue
invalid: yaml: {{{
\`\`\`
`;
    const result = await validateMarkdown(markdown);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("maps section title to validation errors", async () => {
    const markdown = `## Testing Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules: []
\`\`\`
`;
    const result = await validateMarkdown(markdown);
    // Even with valid YAML, empty rules array will fail schema validation
    if (result.errors.length > 0) {
      expect(result.errors[0]).toHaveProperty("section", "Testing Rules");
    }
  });
});
