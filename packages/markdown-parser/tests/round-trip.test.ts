/**
 * Round-trip tests: parse → modify → generate → parse should preserve structure
 */

import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../src/parser.js";
import { buildIR } from "../src/ir-builder.js";
import { generateMarkdown } from "../src/generator.js";

describe("Round-trip fidelity", () => {
  it("should preserve rules after parse → generate → parse", () => {
    const originalMarkdown = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.one
    severity: error
    applies_to:
      - "**/*.ts"
    guidance: Test guidance one
  - id: test.rule.two
    severity: warn
    applies_to:
      - "**/*.js"
    guidance: Test guidance two
\`\`\`
`;

    // Parse
    const { blocks, errors: parseErrors } = parseMarkdown(originalMarkdown);
    expect(parseErrors).toHaveLength(0);
    expect(blocks).toHaveLength(1);

    const { document: ir, errors: buildErrors } = buildIR(blocks, {
      captureMetadata: true,
      originalMarkdown,
    });
    expect(buildErrors).toHaveLength(0);
    expect(ir).toBeDefined();
    expect(ir!.rules).toHaveLength(2);

    // Generate
    const regenerated = generateMarkdown(ir!, { preserveMetadata: true });

    // Parse again
    const { blocks: blocks2, errors: parseErrors2 } =
      parseMarkdown(regenerated);
    expect(parseErrors2).toHaveLength(0);
    expect(blocks2).toHaveLength(1);

    const { document: ir2, errors: buildErrors2 } = buildIR(blocks2);
    expect(buildErrors2).toHaveLength(0);
    expect(ir2).toBeDefined();
    expect(ir2!.rules).toHaveLength(2);

    // Verify rules are identical
    expect(ir2!.rules).toEqual(ir!.rules);
  });

  it("should not include source_format in fenced block", () => {
    const markdown = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.one
    severity: error
    applies_to:
      - "**/*.ts"
    guidance: Test guidance
\`\`\`
`;

    const { blocks } = parseMarkdown(markdown);
    const { document: ir } = buildIR(blocks, {
      captureMetadata: true,
      originalMarkdown: markdown,
    });

    const regenerated = generateMarkdown(ir!, { preserveMetadata: true });

    // Verify source_format is NOT in the fenced block
    expect(regenerated).not.toMatch(/```aligntrue[\s\S]*source_format:/);

    // Verify it still parses correctly
    const { blocks: blocks2 } = parseMarkdown(regenerated);
    const { document: ir2, errors } = buildIR(blocks2);
    expect(errors).toHaveLength(0);
    expect(ir2!.rules).toHaveLength(1);
  });

  it("should handle malformed markdown with internal fields in fence", () => {
    // This is the broken format that auto-pull was creating
    const malformedMarkdown = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.one
    severity: error
    applies_to:
      - "**/*.ts"
    guidance: Test guidance
source_format: markdown
guidance: |-
  1. Edit the rules below to match your project needs
  2. Run \`aligntrue sync\` to update your agent configs
  3. Your AI assistants will follow these rules automatically
  ---
\`\`\`
`;

    // Should still parse the rules correctly despite malformed structure
    const { blocks, errors: parseErrors } = parseMarkdown(malformedMarkdown);
    expect(parseErrors).toHaveLength(0);
    expect(blocks).toHaveLength(1);

    const { document: ir, errors: buildErrors } = buildIR(blocks, {
      captureMetadata: true,
      originalMarkdown: malformedMarkdown,
    });

    expect(buildErrors).toHaveLength(0);
    expect(ir).toBeDefined();
    expect(ir!.rules).toHaveLength(1);
    expect(ir!.rules[0]).toHaveProperty("id", "test.rule.one");

    // Generate clean version
    const cleaned = generateMarkdown(ir!, { preserveMetadata: true });

    // Verify cleaned version doesn't have internal fields in fence
    expect(cleaned).not.toMatch(/```aligntrue[\s\S]*source_format:/);
    expect(cleaned).not.toMatch(/```aligntrue[\s\S]*guidance: \|-/);

    // Verify it parses correctly
    const { blocks: blocks2 } = parseMarkdown(cleaned);
    const { document: ir2, errors: errors2 } = buildIR(blocks2);
    expect(errors2).toHaveLength(0);
    expect(ir2!.rules).toHaveLength(1);
  });

  it("should preserve rule additions after auto-pull cycle", () => {
    // Start with original rules
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.one
    severity: error
    applies_to:
      - "**/*.ts"
    guidance: Original rule
\`\`\`
`;

    // Parse original
    const { blocks } = parseMarkdown(original);
    const { document: ir } = buildIR(blocks);

    // Add a new rule (simulating manual edit)
    ir!.rules.push({
      id: "test.rule.two",
      severity: "warn",
      applies_to: ["**/*.js"],
      guidance: "Manually added rule",
    });

    // Generate updated markdown (simulating auto-pull write)
    const updated = generateMarkdown(ir!);

    // Parse updated
    const { blocks: blocks2 } = parseMarkdown(updated);
    const { document: ir2, errors } = buildIR(blocks2);

    // Verify both rules are present
    expect(errors).toHaveLength(0);
    expect(ir2!.rules).toHaveLength(2);
    expect(ir2!.rules[0]).toHaveProperty("id", "test.rule.one");
    expect(ir2!.rules[1]).toHaveProperty("id", "test.rule.two");
  });
});
