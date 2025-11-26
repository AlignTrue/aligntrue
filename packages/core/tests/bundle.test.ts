/**
 * Tests for bundle merging logic
 */

import { describe, it, expect } from "vitest";
import { mergePacks } from "../src/bundle.js";
import type { AlignPack, AlignSection } from "@aligntrue/schema";

describe("Bundle Merging", () => {
  it("should merge two packs with no conflicts", () => {
    const pack1: AlignPack = {
      id: "pack1",
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

    const pack2: AlignPack = {
      id: "pack2",
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

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.sections).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should detect and resolve rule conflicts (first wins)", () => {
    const pack1: AlignPack = {
      id: "pack1",
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

    const pack2: AlignPack = {
      id: "pack2",
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

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.sections).toHaveLength(1);
    expect(result.pack.sections[0].content).toBe(
      "Error rule for conflicting section",
    ); // pack1 wins (first source)
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].fingerprint).toBe("fp:test-rule-conflict");
    expect(result.conflicts[0].resolution).toBe("pack1");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should merge plugs from multiple packs", () => {
    const pack1: AlignPack = {
      id: "pack1",
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

    const pack2: AlignPack = {
      id: "pack2",
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

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.plugs).toBeDefined();
    expect(result.pack.plugs?.slots).toHaveProperty("slot1");
    expect(result.pack.plugs?.slots).toHaveProperty("slot2");
    expect(result.pack.plugs?.fills).toHaveProperty("slot1");
    expect(result.pack.plugs?.fills).toHaveProperty("slot2");
  });

  it("should merge scopes (union)", () => {
    const pack1: AlignPack = {
      id: "pack1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      scope: {
        applies_to: ["src/**/*.ts"],
        excludes: ["**/*.test.ts"],
      },
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      scope: {
        applies_to: ["lib/**/*.ts"],
        excludes: ["**/*.spec.ts"],
      },
    };

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.scope).toBeDefined();
    expect(result.pack.scope?.applies_to).toContain("src/**/*.ts");
    expect(result.pack.scope?.applies_to).toContain("lib/**/*.ts");
    expect(result.pack.scope?.excludes).toContain("**/*.test.ts");
    expect(result.pack.scope?.excludes).toContain("**/*.spec.ts");
  });

  it("should merge tags (deduplicated)", () => {
    const pack1: AlignPack = {
      id: "pack1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      tags: ["typescript", "testing"],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      tags: ["testing", "security"], // "testing" is duplicate
    };

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.tags).toBeDefined();
    expect(result.pack.tags).toHaveLength(3); // deduplicated
    expect(result.pack.tags).toContain("typescript");
    expect(result.pack.tags).toContain("testing");
    expect(result.pack.tags).toContain("security");
  });

  it("should merge deps (preserve order, deduplicate)", () => {
    const pack1: AlignPack = {
      id: "pack1",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      deps: ["dep1", "dep2"],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
      deps: ["dep2", "dep3"], // "dep2" is duplicate
    };

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.deps).toBeDefined();
    expect(result.pack.deps).toHaveLength(3); // deduplicated
    expect(result.pack.deps).toEqual(["dep1", "dep2", "dep3"]); // order preserved
  });

  it("should sort merged rules by ID for determinism", () => {
    const pack1: AlignPack = {
      id: "pack1",
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

    const pack2: AlignPack = {
      id: "pack2",
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

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.sections).toHaveLength(3);
    expect(result.pack.sections[0].fingerprint).toBe("fp:test-rule-alpha");
    expect(result.pack.sections[1].fingerprint).toBe("fp:test-rule-middle");
    expect(result.pack.sections[2].fingerprint).toBe("fp:test-rule-zebra");
  });

  it("should handle single pack (no merging)", () => {
    const pack: AlignPack = {
      id: "pack1",
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

    const result = mergePacks([pack]);

    expect(result.pack).toEqual(pack);
    expect(result.conflicts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should throw on empty pack array", () => {
    expect(() => mergePacks([])).toThrow("Cannot merge empty pack array");
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

    it("should merge two section-based packs with no conflicts", () => {
      const pack1: AlignPack = {
        id: "pack1",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection1],
      };

      const pack2: AlignPack = {
        id: "pack2",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection2],
      };

      const result = mergePacks([pack1, pack2]);

      expect(result.pack.sections).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should detect and resolve section conflicts (last wins)", () => {
      const pack1: AlignPack = {
        id: "pack1",
        version: "1.0.0",
        spec_version: "1",
        sections: [{ ...mockSection1, content: "Content from pack1" }],
      };

      const pack2: AlignPack = {
        id: "pack2",
        version: "1.0.0",
        spec_version: "1",
        sections: [{ ...mockSection1, content: "Content from pack2" }],
      };

      const result = mergePacks([pack1, pack2]);

      expect(result.pack.sections).toHaveLength(1);
      expect(result.pack.sections?.[0]?.content).toBe("Content from pack2");
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

      const pack1: AlignPack = {
        id: "pack1",
        version: "1.0.0",
        spec_version: "1",
        sections: [section4, section3],
      };

      const result = mergePacks([pack1]);

      expect(result.pack.sections?.[0]?.fingerprint).toBe("fp:aaa-first");
      expect(result.pack.sections?.[1]?.fingerprint).toBe("fp:zzz-last");
    });

    it("should handle single section-based pack", () => {
      const pack: AlignPack = {
        id: "pack1",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection1],
      };

      const result = mergePacks([pack]);

      expect(result.pack).toEqual(pack);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
