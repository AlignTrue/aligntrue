/**
 * Tests for bundle merging logic
 */

import { describe, it, expect } from "vitest";
import { mergeAligns } from "../src/bundle.js";
import type { Align, AlignSection } from "@aligntrue/schema";

describe("Bundle Merging", () => {
  it("should merge two aligns with no conflicts", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Rule One",
          level: 2,
          content: "Error rule for TypeScript files",
          fingerprint: "fp:test-rule-one",
        },
      ],
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Rule Two",
          level: 2,
          content: "Warning rule for JavaScript files",
          fingerprint: "fp:test-rule-two",
        },
      ],
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.sections).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should detect and resolve rule conflicts (first wins)", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Conflict Rule",
          level: 2,
          content: "Error rule for conflicting section",
          fingerprint: "fp:test-rule-conflict",
        },
      ],
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Conflict Rule",
          level: 2,
          content: "Warning rule for conflicting section",
          fingerprint: "fp:test-rule-conflict",
        },
      ],
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.sections).toHaveLength(1);
    expect(result.align.sections[0].content).toBe(
      "Error rule for conflicting section",
    ); // align1 wins (first source)
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].fingerprint).toBe("fp:test-rule-conflict");
    expect(result.conflicts[0].resolution).toBe("align1");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should merge plugs from multiple aligns", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      plugs: {
        slots: {
          slot1: {
            description: "Test slot 1",
            format: "text",
            required: true,
          },
        },
        fills: {
          slot1: "value1",
        },
      },
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      plugs: {
        slots: {
          slot2: {
            description: "Test slot 2",
            format: "command",
            required: false,
          },
        },
        fills: {
          slot2: "value2",
        },
      },
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.plugs).toBeDefined();
    expect(result.align.plugs?.slots).toHaveProperty("slot1");
    expect(result.align.plugs?.slots).toHaveProperty("slot2");
    expect(result.align.plugs?.fills).toHaveProperty("slot1");
    expect(result.align.plugs?.fills).toHaveProperty("slot2");
  });

  it("should merge scopes (union)", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      scope: {
        applies_to: ["src/**/*.ts"],
        excludes: ["**/*.test.ts"],
      },
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      scope: {
        applies_to: ["lib/**/*.ts"],
        excludes: ["**/*.spec.ts"],
      },
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.scope).toBeDefined();
    expect(result.align.scope?.applies_to).toContain("src/**/*.ts");
    expect(result.align.scope?.applies_to).toContain("lib/**/*.ts");
    expect(result.align.scope?.excludes).toContain("**/*.test.ts");
    expect(result.align.scope?.excludes).toContain("**/*.spec.ts");
  });

  it("should merge tags (deduplicated)", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      tags: ["typescript", "testing"],
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      tags: ["testing", "security"], // "testing" is duplicate
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.tags).toBeDefined();
    expect(result.align.tags).toHaveLength(3); // deduplicated
    expect(result.align.tags).toContain("typescript");
    expect(result.align.tags).toContain("testing");
    expect(result.align.tags).toContain("security");
  });

  it("should merge deps (preserve order, deduplicate)", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      deps: ["dep1", "dep2"],
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      deps: ["dep2", "dep3"], // "dep2" is duplicate
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.deps).toBeDefined();
    expect(result.align.deps).toHaveLength(3); // deduplicated
    expect(result.align.deps).toEqual(["dep1", "dep2", "dep3"]); // order preserved
  });

  it("should sort merged rules by ID for determinism", () => {
    const align1: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Zebra Rule",
          level: 2,
          content: "Error rule with zebra fingerprint",
          fingerprint: "fp:test-rule-zebra",
        },
        {
          heading: "Alpha Rule",
          level: 2,
          content: "Warning rule with alpha fingerprint",
          fingerprint: "fp:test-rule-alpha",
        },
      ],
    };

    const align2: Align = {
      id: "align2",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Middle Rule",
          level: 2,
          content: "Info rule with middle fingerprint",
          fingerprint: "fp:test-rule-middle",
        },
      ],
    };

    const result = mergeAligns([align1, align2]);

    expect(result.align.sections).toHaveLength(3);
    expect(result.align.sections[0].fingerprint).toBe("fp:test-rule-alpha");
    expect(result.align.sections[1].fingerprint).toBe("fp:test-rule-middle");
    expect(result.align.sections[2].fingerprint).toBe("fp:test-rule-zebra");
  });

  it("should handle single align (no merging)", () => {
    const align: Align = {
      id: "align1",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Rule One",
          level: 2,
          content: "Error rule for TypeScript files",
          fingerprint: "fp:test-rule-one",
        },
      ],
    };

    const result = mergeAligns([align]);

    expect(result.align).toEqual(align);
    expect(result.conflicts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should throw on empty align array", () => {
    expect(() => mergeAligns([])).toThrow("Cannot merge empty align array");
  });

  // Team mode enhancements: Section-based bundle merging tests
  describe("section-based merging", () => {
    const mockSection1: AlignSection = {
      heading: "Testing Guidelines",
      level: 2,
      content: "Write comprehensive tests for all features.",
      fingerprint: "fp:testing-guidelines",
    };

    const mockSection2: AlignSection = {
      heading: "Code Review",
      level: 2,
      content: "Review all PRs before merging.",
      fingerprint: "fp:code-review",
    };

    it("should merge two section-based aligns with no conflicts", () => {
      const align1: Align = {
        id: "align1",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection1],
      };

      const align2: Align = {
        id: "align2",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection2],
      };

      const result = mergeAligns([align1, align2]);

      expect(result.align.sections).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should detect and resolve section conflicts (first wins by precedence)", () => {
      const align1: Align = {
        id: "align1",
        version: "1.0.0",
        spec_version: "1",
        sections: [{ ...mockSection1, content: "Content from align1" }],
      };

      const align2: Align = {
        id: "align2",
        version: "1.0.0",
        spec_version: "1",
        sections: [{ ...mockSection1, content: "Content from align2" }],
      };

      const result = mergeAligns([align1, align2]);

      expect(result.align.sections).toHaveLength(1);
      expect(result.align.sections?.[0]?.content).toBe("Content from align1");
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].fingerprint).toBe("fp:testing-guidelines");
      expect(result.warnings).toHaveLength(1);
    });

    it("should sort merged sections by fingerprint for determinism", () => {
      const section3: AlignSection = {
        ...mockSection1,
        fingerprint: "fp:aaa-first",
        heading: "AAA First",
      };
      const section4: AlignSection = {
        ...mockSection1,
        fingerprint: "fp:zzz-last",
        heading: "ZZZ Last",
      };

      const align1: Align = {
        id: "align1",
        version: "1.0.0",
        spec_version: "1",
        sections: [section4, section3],
      };

      const result = mergeAligns([align1]);

      expect(result.align.sections?.[0]?.fingerprint).toBe("fp:aaa-first");
      expect(result.align.sections?.[1]?.fingerprint).toBe("fp:zzz-last");
    });

    it("should handle single section-based align", () => {
      const align: Align = {
        id: "align1",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection1],
      };

      const result = mergeAligns([align]);

      expect(result.align).toEqual(align);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
