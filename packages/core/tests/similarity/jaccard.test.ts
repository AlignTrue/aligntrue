/**
 * Tests for Jaccard similarity detection
 */

import { describe, it, expect } from "vitest";
import {
  normalizeTokens,
  jaccardSimilarity,
  findSimilarContent,
  DEFAULT_SIMILARITY_THRESHOLD,
  FORMAT_PRIORITY,
  getFormatPriority,
  getBestFormat,
  type FileWithContent,
} from "../../src/similarity/jaccard.js";

describe("normalizeTokens", () => {
  it("should lowercase and tokenize content", () => {
    const tokens = normalizeTokens("Hello World Test");
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
    expect(tokens.has("test")).toBe(true);
    expect(tokens.has("Hello")).toBe(false); // Should be lowercase
  });

  it("should filter out short tokens", () => {
    const tokens = normalizeTokens("I am a test of the system");
    expect(tokens.has("test")).toBe(true);
    expect(tokens.has("system")).toBe(true);
    expect(tokens.has("am")).toBe(false); // Too short
    expect(tokens.has("a")).toBe(false); // Too short
    expect(tokens.has("of")).toBe(false); // Too short
  });

  it("should remove YAML frontmatter", () => {
    const content = `---
title: Test
description: A test file
---

# Actual Content

This is the real content.`;
    const tokens = normalizeTokens(content);
    expect(tokens.has("title")).toBe(false);
    expect(tokens.has("description")).toBe(false);
    expect(tokens.has("actual")).toBe(true);
    expect(tokens.has("content")).toBe(true);
    expect(tokens.has("real")).toBe(true);
  });

  it("should handle code blocks", () => {
    const content = `# Guide

\`\`\`typescript
const x = 1;
console.log(x);
\`\`\`

Real content here.`;
    const tokens = normalizeTokens(content);
    // Code block content should be replaced with marker
    expect(tokens.has("codeblock")).toBe(true);
    expect(tokens.has("real")).toBe(true);
    expect(tokens.has("content")).toBe(true);
  });

  it("should preserve text from markdown links", () => {
    const content =
      "Check [the documentation](https://example.com) for more info.";
    const tokens = normalizeTokens(content);
    expect(tokens.has("documentation")).toBe(true);
    expect(tokens.has("example")).toBe(false); // URL should be stripped
  });

  it("should handle empty content", () => {
    const tokens = normalizeTokens("");
    expect(tokens.size).toBe(0);
  });

  it("should handle content with only frontmatter", () => {
    const content = `---
title: Test
---
`;
    const tokens = normalizeTokens(content);
    expect(tokens.size).toBe(0);
  });
});

describe("jaccardSimilarity", () => {
  it("should return 1 for identical sets", () => {
    const a = new Set(["hello", "world", "test"]);
    const b = new Set(["hello", "world", "test"]);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it("should return 0 for completely different sets", () => {
    const a = new Set(["hello", "world"]);
    const b = new Set(["foo", "bar"]);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it("should return correct value for partial overlap", () => {
    const a = new Set(["hello", "world", "test"]);
    const b = new Set(["hello", "world", "foo"]);
    // intersection = 2 (hello, world)
    // union = 4 (hello, world, test, foo)
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });

  it("should handle empty sets", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
    expect(jaccardSimilarity(new Set(["a"]), new Set())).toBe(0);
    expect(jaccardSimilarity(new Set(), new Set(["a"]))).toBe(0);
  });

  it("should be symmetric", () => {
    const a = new Set(["hello", "world", "test"]);
    const b = new Set(["hello", "foo", "bar"]);
    expect(jaccardSimilarity(a, b)).toBe(jaccardSimilarity(b, a));
  });
});

describe("findSimilarContent", () => {
  it("should return all files as unique when no overlap", () => {
    const files: FileWithContent[] = [
      { path: "a.md", content: "Alpha beta gamma", type: "cursor" },
      { path: "b.md", content: "Delta epsilon zeta", type: "agents" },
      { path: "c.md", content: "Iota kappa lambda", type: "claude" },
    ];

    const result = findSimilarContent(files);
    expect(result.groups.length).toBe(0);
    expect(result.unique.length).toBe(3);
  });

  it("should group similar files together", () => {
    const sharedContent = `
# Coding Standards

Always use TypeScript.
Follow the existing patterns.
Write tests for new code.
Keep functions small.
Document public APIs.
`;

    const files: FileWithContent[] = [
      {
        path: ".cursor/rules/standards.mdc",
        content: sharedContent,
        type: "cursor",
      },
      { path: "AGENTS.md", content: sharedContent, type: "agents" },
      { path: "CLAUDE.md", content: sharedContent, type: "claude" },
    ];

    const result = findSimilarContent(files);
    expect(result.groups.length).toBe(1);
    expect(result.unique.length).toBe(0);

    const group = result.groups[0]!;
    // Cursor should be canonical (preferred format)
    expect(group.canonical.type).toBe("cursor");
    expect(group.duplicates.length).toBe(2);
  });

  it("should prefer multi-file format as canonical", () => {
    const content = "# Rules\n\nUse TypeScript.\nWrite tests.\nKeep it simple.";

    const files: FileWithContent[] = [
      { path: "AGENTS.md", content, type: "agents" },
      { path: ".cursor/rules/main.mdc", content, type: "cursor" },
    ];

    const result = findSimilarContent(files);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0]!.canonical.type).toBe("cursor");
  });

  it("should handle threshold correctly", () => {
    const base =
      "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu";
    const similar =
      "Alpha beta gamma delta epsilon zeta eta theta iota kappa different words";
    const different =
      "Completely unrelated content that shares no words whatsoever";

    const files: FileWithContent[] = [
      { path: "a.md", content: base, type: "cursor" },
      { path: "b.md", content: similar, type: "agents" },
      { path: "c.md", content: different, type: "claude" },
    ];

    // High threshold should not group
    const highResult = findSimilarContent(files, 0.99);
    expect(highResult.groups.length).toBe(0);
    expect(highResult.unique.length).toBe(3);

    // Lower threshold should group a and b
    const lowResult = findSimilarContent(files, 0.5);
    expect(lowResult.groups.length).toBe(1);
    expect(lowResult.unique.length).toBe(1);
    expect(lowResult.unique[0]!.path).toBe("c.md");
  });

  it("should return empty result for single file", () => {
    const files: FileWithContent[] = [
      { path: "a.md", content: "Hello world", type: "cursor" },
    ];

    const result = findSimilarContent(files);
    expect(result.groups.length).toBe(0);
    expect(result.unique.length).toBe(1);
  });

  it("should return empty result for empty array", () => {
    const result = findSimilarContent([]);
    expect(result.groups.length).toBe(0);
    expect(result.unique.length).toBe(0);
  });

  it("should handle transitive similarity", () => {
    // A is similar to B, B is similar to C, but A might not be directly similar to C
    // They should all be in the same group
    const base = "one two three four five six seven eight nine ten";
    const middle = "one two three four five alpha beta gamma delta epsilon";
    const far = "alpha beta gamma delta epsilon foo bar baz qux quux";

    const files: FileWithContent[] = [
      { path: "a.md", content: base, type: "cursor" },
      { path: "b.md", content: middle, type: "agents" },
      { path: "c.md", content: far, type: "claude" },
    ];

    const result = findSimilarContent(files, 0.3);
    // All should be in the same group due to transitive similarity
    expect(result.groups.length).toBe(1);
    expect(result.groups[0]!.duplicates.length).toBe(2);
  });
});

describe("DEFAULT_SIMILARITY_THRESHOLD", () => {
  it("should be a reasonable value between 0.5 and 0.9", () => {
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBeGreaterThanOrEqual(0.5);
    expect(DEFAULT_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(0.9);
  });
});

describe("real-world scenarios", () => {
  it("should detect copy-pasted rules across formats", () => {
    const cursorContent = `---
description: TypeScript coding standards
when: always
---

# TypeScript Guidelines

## Type Safety
- Always use strict mode
- Prefer interfaces over types for objects
- Use const assertions for literals

## Code Style
- Use meaningful variable names
- Keep functions under 50 lines
- Document public APIs with JSDoc
`;

    const agentsContent = `# TypeScript Guidelines

## Type Safety
- Always use strict mode
- Prefer interfaces over types for objects
- Use const assertions for literals

## Code Style
- Use meaningful variable names
- Keep functions under 50 lines
- Document public APIs with JSDoc
`;

    const claudeContent = `# TypeScript Guidelines

This document outlines our TypeScript coding standards.

## Type Safety
- Always use strict mode
- Prefer interfaces over types for objects
- Use const assertions for literals

## Code Style
- Use meaningful variable names
- Keep functions under 50 lines
- Document public APIs with JSDoc

Generated by: AlignTrue
`;

    const files: FileWithContent[] = [
      {
        path: ".cursor/rules/typescript.mdc",
        content: cursorContent,
        type: "cursor",
      },
      { path: "AGENTS.md", content: agentsContent, type: "agents" },
      { path: "CLAUDE.md", content: claudeContent, type: "claude" },
    ];

    const result = findSimilarContent(files, DEFAULT_SIMILARITY_THRESHOLD);

    // All three should be grouped together
    expect(result.groups.length).toBe(1);
    expect(result.unique.length).toBe(0);

    const group = result.groups[0]!;
    // Cursor should be canonical
    expect(group.canonical.type).toBe("cursor");
    expect(group.duplicates.length).toBe(2);

    // Both duplicates should have high similarity
    for (const dup of group.duplicates) {
      expect(dup.similarity).toBeGreaterThan(0.7);
    }
  });

  it("should not group genuinely different rules", () => {
    const typescriptRules = `# TypeScript Guidelines
Use strict mode. Prefer interfaces. Use const assertions.
Write unit tests for all functions.
`;

    const securityRules = `# Security Policy
Never log secrets. Validate all inputs. Use parameterized queries.
Enable HTTPS only. Implement rate limiting.
`;

    const files: FileWithContent[] = [
      { path: "typescript.md", content: typescriptRules, type: "cursor" },
      { path: "security.md", content: securityRules, type: "agents" },
    ];

    const result = findSimilarContent(files, DEFAULT_SIMILARITY_THRESHOLD);

    // Should not be grouped
    expect(result.groups.length).toBe(0);
    expect(result.unique.length).toBe(2);
  });
});

describe("FORMAT_PRIORITY", () => {
  it("should have cursor as highest priority (lowest number)", () => {
    expect(FORMAT_PRIORITY["cursor"]).toBe(1);
  });

  it("should have multi-file formats as higher priority than single-file", () => {
    expect(FORMAT_PRIORITY["cursor"]).toBeLessThan(FORMAT_PRIORITY["agents"]!);
    expect(FORMAT_PRIORITY["cursor"]).toBeLessThan(FORMAT_PRIORITY["claude"]!);
    expect(FORMAT_PRIORITY["cursor"]).toBeLessThan(
      FORMAT_PRIORITY["windsurf"]!,
    );
  });

  it("should have agents before claude in priority", () => {
    expect(FORMAT_PRIORITY["agents"]).toBeLessThan(FORMAT_PRIORITY["claude"]!);
  });
});

describe("getFormatPriority", () => {
  it("should return correct priority for known formats", () => {
    expect(getFormatPriority("cursor")).toBe(1);
    expect(getFormatPriority("agents")).toBe(10);
    expect(getFormatPriority("claude")).toBe(11);
  });

  it("should return 100 for unknown formats", () => {
    expect(getFormatPriority("unknown-format")).toBe(100);
    expect(getFormatPriority("other")).toBe(100);
  });
});

describe("getBestFormat", () => {
  it("should return cursor when cursor files are present", () => {
    expect(getBestFormat(["cursor", "agents", "claude"])).toBe("cursor");
    expect(getBestFormat(["agents", "cursor", "claude"])).toBe("cursor");
    expect(getBestFormat(["claude", "agents", "cursor"])).toBe("cursor");
  });

  it("should return agents when cursor is not present", () => {
    expect(getBestFormat(["agents", "claude"])).toBe("agents");
    expect(getBestFormat(["claude", "agents"])).toBe("agents");
  });

  it("should return fallback for empty array", () => {
    expect(getBestFormat([])).toBe("multi-file");
    expect(getBestFormat([], "custom-fallback")).toBe("custom-fallback");
  });

  it("should handle single type", () => {
    expect(getBestFormat(["claude"])).toBe("claude");
    expect(getBestFormat(["cursor"])).toBe("cursor");
  });

  it("should handle unknown types with low priority", () => {
    // Unknown types get priority 100, so known types win
    expect(getBestFormat(["unknown", "agents"])).toBe("agents");
    expect(getBestFormat(["unknown", "other", "cursor"])).toBe("cursor");
  });

  it("should prefer cursor over agents even when agents is first", () => {
    // This is the exact scenario from the bug report:
    // 4 Cursor files (unique) + 1 AGENTS.md (canonical of similarity group)
    // CLAUDE.md is a duplicate and not in the types array
    const types = ["cursor", "cursor", "cursor", "cursor", "agents"];
    expect(getBestFormat(types)).toBe("cursor");
  });

  it("should work correctly for init overlap scenario", () => {
    // Scenario: 4 Cursor files (unique, no duplicates) + AGENTS.md/CLAUDE.md similarity group
    // The types array includes all rules to import (canonicals + uniques)
    // AGENTS.md is canonical of the similarity group, CLAUDE.md is backed up
    // Cursor files are unique (not in any similarity group)
    const allTypesToImport = ["cursor", "cursor", "cursor", "cursor", "agents"];
    const fallbackFromSimilarityGroup = "agents"; // From similarityGroups[0].canonical.type

    const result = getBestFormat(allTypesToImport, fallbackFromSimilarityGroup);

    // Should recommend cursor (priority 1) over agents (priority 10)
    expect(result).toBe("cursor");
  });
});
