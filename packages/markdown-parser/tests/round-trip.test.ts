import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseMarkdown } from "../src/parser.js";
import { buildIR } from "../src/ir-builder.js";
import { generateMarkdown } from "../src/generator.js";
import type { IRDocument } from "../src/ir-builder.js";

describe("Markdown Round-Trip", () => {
  it("golden repo round-trip is semantically identical", () => {
    // Read golden repo markdown
    const goldenRepoPath = join(
      process.cwd(),
      "../../examples/golden-repo/.aligntrue/rules.md",
    );
    const original = readFileSync(goldenRepoPath, "utf8");

    // Parse markdown → IR
    const parseResult = parseMarkdown(original);
    expect(parseResult.errors).toEqual([]);

    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });
    expect(irResult.errors).toEqual([]);
    expect(irResult.document).toBeDefined();

    // Generate markdown from IR
    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    // Parse again to verify semantic equivalence
    const parseResult2 = parseMarkdown(regenerated);
    const irResult2 = buildIR(parseResult2.blocks);

    // Compare IR documents (semantically equivalent)
    expect(irResult2.document?.id).toBe(irResult.document?.id);
    expect(irResult2.document?.version).toBe(irResult.document?.version);
    expect(irResult2.document?.spec_version).toBe(
      irResult.document?.spec_version,
    );
    expect(irResult2.document?.rules).toHaveLength(
      irResult.document!.rules.length,
    );

    // Verify structure is preserved
    expect(regenerated).toContain("# AlignTrue Rules");
    expect(regenerated).toContain("```aligntrue");
    expect(regenerated).toContain("testing.require.tests");
    expect(regenerated).toContain("code.review.no.todos");
    expect(regenerated).toContain("docs.public.api");
    expect(regenerated).toContain("security.no.secrets");
    expect(regenerated).toContain("typescript.no.any");

    // Note: Exact quote style (single vs double) may differ due to YAML library preferences
    // This is semantically identical in YAML
  });

  it("YAML → MD → IR → MD produces valid markdown", () => {
    // Start with IR (simulating YAML source)
    const ir: IRDocument = {
      id: "test-rules",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "testing.require.tests",
          severity: "warn",
          applies_to: ["**/*.ts"],
          guidance: "All features must have tests.",
        },
      ],
    };

    // Convert to markdown
    const markdown = generateMarkdown(ir);

    // Parse back to IR
    const parseResult = parseMarkdown(markdown);
    expect(parseResult.errors).toEqual([]);

    const irResult = buildIR(parseResult.blocks);
    expect(irResult.errors).toEqual([]);
    expect(irResult.document).toBeDefined();

    // Verify core fields preserved
    expect(irResult.document?.id).toBe("test-rules");
    expect(irResult.document?.version).toBe("1.0.0");
    expect(irResult.document?.spec_version).toBe("1");
    expect(irResult.document?.rules).toHaveLength(1);
  });

  it("guidance prose preserved in round-trip", () => {
    const original = `# My Rules

This is important guidance about our rules.

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]
\`\`\`
`;

    // Parse → IR
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    expect(irResult.document?.guidance).toContain("important guidance");
    expect(irResult.document?._markdown_meta?.guidance_position).toBe(
      "before-block",
    );

    // Generate → should place guidance before block again
    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    // Guidance should be between header and code block
    const guidanceIndex = regenerated.indexOf("important guidance");
    const blockIndex = regenerated.indexOf("```aligntrue");

    expect(guidanceIndex).toBeGreaterThan(0);
    expect(guidanceIndex).toBeLessThan(blockIndex);
  });

  it("vendor metadata preserved in round-trip", () => {
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]
    vendor:
      cursor:
        ai_hint: "Suggest test scaffolding with vitest"
        quick_fix: true
\`\`\`
`;

    // Parse → IR
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    const rule = irResult.document?.rules[0] as any;
    expect(rule.vendor?.cursor?.ai_hint).toContain("vitest");

    // Generate → vendor metadata should survive
    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    expect(regenerated).toContain("vendor:");
    expect(regenerated).toContain("cursor:");
    expect(regenerated).toContain("ai_hint:");
    expect(regenerated).toContain("vitest");
  });

  it("canonical format when no metadata", () => {
    // IR without metadata
    const ir: IRDocument = {
      id: "test-rules",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "testing.require.tests",
          severity: "warn",
          applies_to: ["**/*.ts"],
        },
      ],
    };

    // Generate markdown
    const markdown = generateMarkdown(ir);

    // Should use canonical defaults
    expect(markdown).toContain("# AlignTrue Rules");
    expect(markdown).not.toContain("\r\n"); // LF endings
    expect(markdown).not.toContain("\t"); // Spaces not tabs

    // Parse back
    const parseResult = parseMarkdown(markdown);
    const irResult = buildIR(parseResult.blocks);

    expect(irResult.errors).toEqual([]);
    expect(irResult.document?.id).toBe("test-rules");
  });

  it("multiple rules preserved in round-trip", () => {
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: error
    applies_to: ["src/**/*.ts"]
    guidance: "All features must have tests."
  - id: code.review.no.todos
    severity: warn
    applies_to: ["**/*.ts", "**/*.js"]
    guidance: "Convert TODOs to GitHub issues."
  - id: docs.public.api
    severity: info
    applies_to: ["src/**/index.ts"]
    guidance: "Public APIs need JSDoc."
\`\`\`
`;

    // Round-trip
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    expect(irResult.document?.rules).toHaveLength(3);

    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    // All three rules should be present
    expect(regenerated).toContain("testing.require.tests");
    expect(regenerated).toContain("code.review.no.todos");
    expect(regenerated).toContain("docs.public.api");

    // Parse again to verify structure
    const parseResult2 = parseMarkdown(regenerated);
    const irResult2 = buildIR(parseResult2.blocks);

    expect(irResult2.document?.rules).toHaveLength(3);
  });

  it("handles rules with all optional fields", () => {
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    aliases: ["testing-require-tests"]
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: "All features must have tests."
    tags:
      - testing
      - quality
    vendor:
      cursor:
        ai_hint: "Suggest test scaffolding"
\`\`\`
`;

    // Round-trip
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    const rule = irResult.document?.rules[0] as any;
    expect(rule.aliases).toEqual(["testing-require-tests"]);
    expect(rule.tags).toEqual(["testing", "quality"]);

    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    expect(regenerated).toContain("aliases:");
    expect(regenerated).toContain("tags:");
    expect(regenerated).toContain("vendor:");
  });

  it("preserves source_format field", () => {
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
source_format: markdown
rules: []
\`\`\`
`;

    // Round-trip
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    expect(irResult.document?.source_format).toBe("markdown");

    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    expect(regenerated).toContain("source_format: markdown");
  });

  it("handles empty rules array", () => {
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules: []
\`\`\`
`;

    // Round-trip
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    expect(irResult.document?.rules).toEqual([]);

    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    expect(regenerated).toContain("rules: []");

    // Verify can parse back
    const parseResult2 = parseMarkdown(regenerated);
    const irResult2 = buildIR(parseResult2.blocks);

    expect(irResult2.errors).toEqual([]);
    expect(irResult2.document?.rules).toEqual([]);
  });

  it("preserves 4-space indentation in round-trip", () => {
    const original = `# AlignTrue Rules

\`\`\`aligntrue
id: test-rules
version: 1.0.0
spec_version: "1"
rules:
    - id: testing.require.tests
      severity: warn
      applies_to: ["**/*.ts"]
\`\`\`
`;

    // Round-trip with metadata
    const parseResult = parseMarkdown(original);
    const irResult = buildIR(parseResult.blocks, {
      captureMetadata: true,
      originalMarkdown: original,
    });

    expect(
      irResult.document?._markdown_meta?.whitespace_style?.indent_size,
    ).toBe(4);

    const regenerated = generateMarkdown(irResult.document!, {
      preserveMetadata: true,
    });

    // Should use 4-space indent
    expect(regenerated).toMatch(/\n    - id: testing\.require\.tests/);
  });
});
