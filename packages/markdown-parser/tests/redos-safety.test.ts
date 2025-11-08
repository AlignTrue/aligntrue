import { describe, it, expect } from "vitest";
import { parseAgentsMd } from "../src/parsers/agents-md";

describe("ReDoS safety", () => {
  it("handles many repeated delimiters safely", () => {
    const malformed = `<!-- aligntrue:begin {"id":"test"} -->
## Rule: Test Rule

Guidance here.
`.repeat(100);

    // Should not hang or throw due to ReDoS
    expect(() => parseAgentsMd(malformed)).not.toThrow(/polynomial|ReDoS/i);
  });

  it("completes within reasonable time for large valid input", () => {
    const start = performance.now();
    const valid = `<!-- aligntrue:begin {"id":"test.${Math.random()}"} -->
## Rule: Test Rule

Guidance here.

<!-- aligntrue:end {"id":"test"} -->
`.repeat(50);

    parseAgentsMd(valid);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // Should complete quickly
  });

  it("throws error when max iterations exceeded", () => {
    // Provide enough unclosed blocks to trigger max iterations
    const massiveInput = `<!-- aligntrue:begin {"id":"test"} -->
## Rule: Test Rule

`.repeat(2000);

    expect(() => parseAgentsMd(massiveInput)).toThrow(
      /exceeded maximum iterations/,
    );
  });

  it("parses valid HTML comment format correctly", () => {
    const content = `<!-- aligntrue:begin {"id":"test.rule"} -->
## Rule: Test Rule

**Severity:** ERROR

**Scope:** **/*.ts

This is a test rule.

<!-- aligntrue:end {"id":"test.rule"} -->`;

    const result = parseAgentsMd(content);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.id).toBe("test.rule");
    expect(result.rules[0]?.severity).toBe("error");
  });
});
