/**
 * Tests for selector parser (Overlays system)
 */

import { describe, it, expect } from "vitest";
import {
  parseSelector,
  validateSelector,
  normalizeSelector,
  compareSelectors,
} from "../../src/overlays/selector-parser.js";

describe("parseSelector", () => {
  it("parses rule selector with simple id", () => {
    const result = parseSelector("rule[id=test-rule]");
    expect(result).toEqual({
      type: "rule",
      ruleId: "test-rule",
    });
  });

  it("parses rule selector with complex id", () => {
    const result = parseSelector("rule[id=org/category/my-rule-123]");
    expect(result).toEqual({
      type: "rule",
      ruleId: "org/category/my-rule-123",
    });
  });

  it("parses property path selector", () => {
    const result = parseSelector("severity");
    expect(result).toEqual({
      type: "property",
      propertyPath: ["severity"],
    });
  });

  it("parses nested property path selector", () => {
    const result = parseSelector("check.inputs.pattern");
    expect(result).toEqual({
      type: "property",
      propertyPath: ["check", "inputs", "pattern"],
    });
  });

  it("parses array index selector", () => {
    const result = parseSelector("rules[0]");
    expect(result).toEqual({
      type: "array_index",
      propertyPath: ["rules"],
      arrayIndex: 0,
    });
  });

  it("parses array index selector with nested path", () => {
    const result = parseSelector("check.inputs.files[2]");
    expect(result).toEqual({
      type: "array_index",
      propertyPath: ["check", "inputs", "files"],
      arrayIndex: 2,
    });
  });

  it("returns null for empty selector", () => {
    expect(parseSelector("")).toBeNull();
    expect(parseSelector("   ")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(parseSelector(null as any)).toBeNull();
    expect(parseSelector(undefined as any)).toBeNull();
  });

  it("returns null for selector with wildcards", () => {
    expect(parseSelector("rule[id=test-*]")).toBeNull();
    expect(parseSelector("path.*.property")).toBeNull();
    expect(parseSelector("rule[id=test-?]")).toBeNull();
  });

  it("handles whitespace trimming", () => {
    const result = parseSelector("  rule[id=test]  ");
    expect(result).toEqual({
      type: "rule",
      ruleId: "test",
    });
  });
});

describe("validateSelector", () => {
  it("validates correct rule selector", () => {
    const result = validateSelector("rule[id=test-rule]");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("validates correct property path selector", () => {
    const result = validateSelector("check.inputs.pattern");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("validates correct array index selector", () => {
    const result = validateSelector("rules[0]");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects empty selector", () => {
    const result = validateSelector("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects selector with wildcards", () => {
    const result = validateSelector("rule[id=test-*]");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Wildcards");
  });

  it("rejects selector with regex patterns", () => {
    const result = validateSelector("rule[id=test.*]");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Wildcards"); // .* is caught by wildcard check first
  });

  it("rejects selector with computed functions", () => {
    const result = validateSelector("rules[length()]");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Computed functions");
  });

  it("rejects invalid rule selector syntax", () => {
    const result = validateSelector("rule[test]");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid selector syntax");
  });

  it("rejects rule selector with empty id", () => {
    const result = validateSelector("rule[id=]");
    expect(result.valid).toBe(false);
  });

  it("rejects property path with too many levels", () => {
    const deepPath = Array(15).fill("level").join(".");
    const result = validateSelector(deepPath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("maximum depth");
  });

  it("rejects array index out of range", () => {
    const result = validateSelector("rules[1001]");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Array index");
  });

  it("rejects negative array index", () => {
    const result = validateSelector("rules[-1]");
    expect(result.valid).toBe(false);
  });
});

describe("normalizeSelector", () => {
  it("normalizes rule selector", () => {
    expect(normalizeSelector("  rule[id=test]  ")).toBe("rule[id=test]");
  });

  it("normalizes property path selector", () => {
    expect(normalizeSelector("  check.inputs.pattern  ")).toBe(
      "check.inputs.pattern",
    );
  });

  it("normalizes array index selector", () => {
    expect(normalizeSelector("rules[0]")).toBe("rules[0]");
  });

  it("handles invalid selectors gracefully", () => {
    expect(normalizeSelector("invalid[*")).toBe("invalid[*");
  });
});

describe("compareSelectors", () => {
  it("orders rule selectors before property selectors", () => {
    expect(compareSelectors("rule[id=a]", "severity")).toBeLessThan(0);
    expect(compareSelectors("severity", "rule[id=a]")).toBeGreaterThan(0);
  });

  it("orders property selectors before array selectors", () => {
    expect(compareSelectors("severity", "rules[0]")).toBeLessThan(0);
    expect(compareSelectors("rules[0]", "severity")).toBeGreaterThan(0);
  });

  it("orders rule selectors lexicographically within type", () => {
    expect(compareSelectors("rule[id=a]", "rule[id=b]")).toBeLessThan(0);
    expect(compareSelectors("rule[id=b]", "rule[id=a]")).toBeGreaterThan(0);
    expect(compareSelectors("rule[id=a]", "rule[id=a]")).toBe(0);
  });

  it("orders property paths lexicographically", () => {
    expect(compareSelectors("check.inputs", "severity")).toBeLessThan(0);
    expect(compareSelectors("severity", "check.inputs")).toBeGreaterThan(0);
  });

  it("handles invalid selectors", () => {
    const result = compareSelectors("invalid[*", "rule[id=test]");
    expect(typeof result).toBe("number");
  });
});
