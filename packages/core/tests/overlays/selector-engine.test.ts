/**
 * Tests for selector engine (Overlays system)
 */

import { describe, it, expect } from "vitest";
import type { AlignPack } from "@aligntrue/schema";
import {
  evaluateSelector,
  evaluateSelectors,
  findStaleSelectors,
  findAmbiguousSelectors,
} from "../../src/overlays/selector-engine.js";

// Mock AlignPack IR for testing
const mockIR: AlignPack = {
  id: "test-pack",
  version: "1.0.0",
  spec_version: "1",
  summary: "Test pack for overlay engine",
  sections: [
    {
      heading: "Rule One",
      level: 2,
      content: "First rule",
      fingerprint: "rule-one",
    },
    {
      heading: "Rule Two",
      level: 2,
      content: "Second rule",
      fingerprint: "rule-two",
    },
    {
      heading: "Rule Three",
      level: 2,
      content: "Third rule",
      fingerprint: "rule-three",
    },
  ],
};

describe("evaluateSelector - rule selectors", () => {
  it("matches single rule by id", () => {
    const result = evaluateSelector("rule[id=rule-one]", mockIR);
    expect(result.success).toBe(true);
    expect(result.targetPath).toEqual(["sections", "0"]);
    expect(result.targetValue).toEqual(mockIR.sections[0]);
    expect(result.matchCount).toBe(1);
  });

  it("matches rule at different index", () => {
    const result = evaluateSelector("rule[id=rule-two]", mockIR);
    expect(result.success).toBe(true);
    expect(result.targetPath).toEqual(["sections", "1"]);
    expect(result.matchCount).toBe(1);
  });

  it("fails when rule not found", () => {
    const result = evaluateSelector("rule[id=nonexistent]", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No rule found");
    expect(result.matchCount).toBe(0);
  });

  it("fails when IR has no sections array", () => {
    const emptyIR = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
    } as any;
    const result = evaluateSelector("rule[id=test]", emptyIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No rule found");
  });

  it("detects multiple matching rules (ambiguous)", () => {
    const duplicateIR: AlignPack = {
      ...mockIR,
      sections: [
        { heading: "Dup A", level: 2, content: "A", fingerprint: "dup" },
        { heading: "Dup B", level: 2, content: "B", fingerprint: "dup" },
      ],
    };
    const result = evaluateSelector("rule[id=dup]", duplicateIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("matched 2 rules");
    expect(result.matchCount).toBe(2);
  });
});

describe("evaluateSelector - property path selectors", () => {
  it("matches top-level property", () => {
    const result = evaluateSelector("id", mockIR);
    expect(result.success).toBe(true);
    expect(result.targetPath).toEqual(["id"]);
    expect(result.targetValue).toBe("test-pack");
  });

  it("matches nested property", () => {
    const result = evaluateSelector("sections", mockIR);
    expect(result.success).toBe(true);
    expect(result.targetPath).toEqual(["sections"]);
    expect(result.targetValue).toEqual(mockIR.sections);
  });

  it("fails when property does not exist", () => {
    const result = evaluateSelector("nonexistent", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("fails when intermediate property does not exist", () => {
    const result = evaluateSelector("check.nonexistent.value", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("fails when path traverses non-object", () => {
    const result = evaluateSelector("id.subprop", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not an object");
  });
});

describe("evaluateSelector - array index selectors", () => {
  it("matches array element by index", () => {
    const result = evaluateSelector("sections[0]", mockIR);
    expect(result.success).toBe(true);
    expect(result.targetPath).toEqual(["sections", "0"]);
    expect(result.targetValue).toEqual(mockIR.sections[0]);
  });

  it("matches array element at different index", () => {
    const result = evaluateSelector("sections[2]", mockIR);
    expect(result.success).toBe(true);
    expect(result.targetPath).toEqual(["sections", "2"]);
    expect(result.targetValue).toEqual(mockIR.sections[2]);
  });

  it("fails when array index out of bounds", () => {
    const result = evaluateSelector("sections[99]", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("out of bounds");
  });

  it("fails when property is not an array", () => {
    const result = evaluateSelector("id[0]", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not an array");
  });

  it("matches nested array element", () => {
    const result = evaluateSelector("sections[1]", mockIR);
    expect(result.success).toBe(true);
    // Verify we can access nested properties of the matched rule
    const rule = result.targetValue as any;
    expect(rule.heading).toBe("Rule Two");
    expect(rule.fingerprint).toBe("rule-two");
  });
});

describe("evaluateSelector - invalid selectors", () => {
  it("fails for invalid selector syntax", () => {
    const result = evaluateSelector("invalid[*", mockIR);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid selector syntax");
  });

  it("fails for empty selector", () => {
    const result = evaluateSelector("", mockIR);
    expect(result.success).toBe(false);
  });
});

describe("evaluateSelectors - batch evaluation", () => {
  it("evaluates multiple selectors", () => {
    const selectors = ["rule[id=rule-one]", "rule[id=rule-two]", "id"];
    const results = evaluateSelectors(selectors, mockIR);
    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(results[2].success).toBe(true);
  });

  it("returns results in same order as input", () => {
    const selectors = ["id", "version", "spec_version"];
    const results = evaluateSelectors(selectors, mockIR);
    expect(results[0].targetValue).toBe("test-pack");
    expect(results[1].targetValue).toBe("1.0.0");
    expect(results[2].targetValue).toBe("1");
  });

  it("handles mix of successful and failed evaluations", () => {
    const selectors = ["rule[id=rule-one]", "nonexistent", "version"];
    const results = evaluateSelectors(selectors, mockIR);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });

  it("handles empty selector array", () => {
    const results = evaluateSelectors([], mockIR);
    expect(results).toEqual([]);
  });
});

describe("findStaleSelectors", () => {
  it("finds selectors that do not match", () => {
    const selectors = [
      "rule[id=rule-one]",
      "rule[id=nonexistent]",
      "rule[id=another-missing]",
    ];
    const stale = findStaleSelectors(selectors, mockIR);
    expect(stale).toEqual(["rule[id=nonexistent]", "rule[id=another-missing]"]);
  });

  it("returns empty array when all selectors match", () => {
    const selectors = ["rule[id=rule-one]", "rule[id=rule-two]", "version"];
    const stale = findStaleSelectors(selectors, mockIR);
    expect(stale).toEqual([]);
  });

  it("excludes ambiguous selectors from stale list", () => {
    const duplicateIR: AlignPack = {
      ...mockIR,
      sections: [
        { heading: "Dup A", level: 2, content: "A", fingerprint: "dup" },
        { heading: "Dup B", level: 2, content: "B", fingerprint: "dup" },
      ],
    };
    const selectors = ["rule[id=dup]", "rule[id=missing]"];
    const stale = findStaleSelectors(selectors, duplicateIR);
    // dup is ambiguous (2 matches), not stale (0 matches)
    expect(stale).toEqual(["rule[id=missing]"]);
  });
});

describe("findAmbiguousSelectors", () => {
  it("finds selectors that match multiple targets", () => {
    const duplicateIR: AlignPack = {
      ...mockIR,
      sections: [
        { heading: "Dup A", level: 2, content: "A", fingerprint: "dup" },
        { heading: "Dup B", level: 2, content: "B", fingerprint: "dup" },
        { heading: "Triple C", level: 2, content: "C", fingerprint: "triple" },
        { heading: "Triple D", level: 2, content: "D", fingerprint: "triple" },
        { heading: "Triple E", level: 2, content: "E", fingerprint: "triple" },
      ],
    };
    const selectors = ["rule[id=dup]", "rule[id=triple]", "rule[id=unique]"];
    const ambiguous = findAmbiguousSelectors(selectors, duplicateIR);
    expect(ambiguous).toEqual([
      { selector: "rule[id=dup]", matchCount: 2 },
      { selector: "rule[id=triple]", matchCount: 3 },
    ]);
  });

  it("returns empty array when all selectors match exactly one", () => {
    const selectors = ["rule[id=rule-one]", "rule[id=rule-two]"];
    const ambiguous = findAmbiguousSelectors(selectors, mockIR);
    expect(ambiguous).toEqual([]);
  });

  it("excludes stale selectors from ambiguous list", () => {
    const selectors = ["rule[id=missing]", "rule[id=rule-one]"];
    const ambiguous = findAmbiguousSelectors(selectors, mockIR);
    expect(ambiguous).toEqual([]);
  });
});
