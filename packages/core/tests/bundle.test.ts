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
      rules: [
        {
          id: "test.rule.one",
          severity: "error",
          applies_to: ["**/*.ts"],
        },
      ],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.two",
          severity: "warn",
          applies_to: ["**/*.js"],
        },
      ],
    };

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.rules).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("should detect and resolve rule conflicts (last wins)", () => {
    const pack1: AlignPack = {
      id: "pack1",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.conflict",
          severity: "error",
          applies_to: ["**/*.ts"],
        },
      ],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.conflict",
          severity: "warn",
          applies_to: ["**/*.js"],
        },
      ],
    };

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.rules).toHaveLength(1);
    expect(result.pack.rules[0].severity).toBe("warn"); // pack2 wins
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].ruleId).toBe("test.rule.conflict");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should merge plugs from multiple packs", () => {
    const pack1: AlignPack = {
      id: "pack1",
      version: "1.0.0",
      spec_version: "1",
      rules: [],
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
      rules: [],
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
      rules: [],
      scope: {
        applies_to: ["src/**/*.ts"],
        excludes: ["**/*.test.ts"],
      },
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      rules: [],
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
      rules: [],
      tags: ["typescript", "testing"],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      rules: [],
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
      rules: [],
      deps: ["dep1", "dep2"],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      rules: [],
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
      rules: [
        {
          id: "test.rule.zebra",
          severity: "error",
          applies_to: ["**/*"],
        },
        {
          id: "test.rule.alpha",
          severity: "warn",
          applies_to: ["**/*"],
        },
      ],
    };

    const pack2: AlignPack = {
      id: "pack2",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.middle",
          severity: "info",
          applies_to: ["**/*"],
        },
      ],
    };

    const result = mergePacks([pack1, pack2]);

    expect(result.pack.rules).toHaveLength(3);
    expect(result.pack.rules[0].id).toBe("test.rule.alpha");
    expect(result.pack.rules[1].id).toBe("test.rule.middle");
    expect(result.pack.rules[2].id).toBe("test.rule.zebra");
  });

  it("should handle single pack (no merging)", () => {
    const pack: AlignPack = {
      id: "pack1",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.one",
          severity: "error",
          applies_to: ["**/*.ts"],
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

  // Phase 8: Section-based bundle merging tests
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
      expect(result.conflicts[0].ruleId).toBe("fp:testing-guidelines");
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

    it("should warn when mixing section-based and rule-based packs", () => {
      const sectionPack: AlignPack = {
        id: "section-pack",
        version: "1.0.0",
        spec_version: "1",
        sections: [mockSection1],
      };

      const rulePack: AlignPack = {
        id: "rule-pack",
        version: "1.0.0",
        spec_version: "1",
        rules: [
          {
            id: "test.rule",
            severity: "error",
            applies_to: ["**/*.ts"],
          },
        ],
      };

      const result = mergePacks([sectionPack, rulePack]);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("format mismatch");
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
