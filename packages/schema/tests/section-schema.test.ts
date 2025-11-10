/**
 * Tests for section-based schema support
 */

import { describe, it, expect } from "vitest";
import { type AlignPack, type AlignSection, getRules } from "../src/index.js";

describe("AlignSection type", () => {
  it("accepts valid section structure", () => {
    const section: AlignSection = {
      heading: "Testing Instructions",
      level: 2,
      content: "Run tests before committing.",
      fingerprint: "testing-instructions-abc123",
    };

    expect(section.heading).toBe("Testing Instructions");
    expect(section.level).toBe(2);
    expect(section.fingerprint).toBe("testing-instructions-abc123");
  });

  it("accepts section with explicit ID", () => {
    const section: AlignSection = {
      heading: "Security",
      level: 2,
      content: "Never commit secrets.",
      fingerprint: "custom-security-id",
      explicitId: "custom-security-id",
    };

    expect(section.explicitId).toBe("custom-security-id");
  });

  it("accepts section with vendor metadata", () => {
    const section: AlignSection = {
      heading: "Testing",
      level: 2,
      content: "Content",
      fingerprint: "testing-abc123",
      vendor: {
        cursor: {
          mode: "always",
          applies_to: ["**/*.ts"],
        },
      },
    };

    expect(section.vendor).toBeDefined();
    expect(section.vendor!.cursor.mode).toBe("always");
  });
});

describe("AlignPack with sections", () => {
  it("accepts pack with sections", () => {
    const pack: AlignPack = {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Testing",
          level: 2,
          content: "Run tests.",
          fingerprint: "testing-abc123",
        },
      ],
    };

    expect(pack.sections).toHaveLength(1);
    expect(pack.sections![0]!.heading).toBe("Testing");
  });

  it("accepts pack with rules (legacy)", () => {
    const pack: AlignPack = {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "testing.require.tests",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Run tests.",
        },
      ],
    };

    expect(pack.rules).toHaveLength(1);
    expect(pack.rules![0]!.id).toBe("testing.require.tests");
  });

  it("accepts pack with both rules and sections (migration)", () => {
    const pack: AlignPack = {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "old.rule",
          severity: "warn",
          applies_to: ["**/*"],
        },
      ],
      sections: [
        {
          heading: "New Section",
          level: 2,
          content: "Content",
          fingerprint: "new-abc123",
        },
      ],
    };

    expect(pack.rules).toHaveLength(1);
    expect(pack.sections).toHaveLength(1);
  });
});

describe("isSectionBasedPack", () => {
  it("returns true for pack with sections", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test",
          level: 2,
          content: "Content",
          fingerprint: "test-abc",
        },
      ],
    };

    expect(isSectionBasedPack(pack)).toBe(true);
  });

  it("returns false for pack with only rules", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*"],
        },
      ],
    };

    expect(isSectionBasedPack(pack)).toBe(false);
  });

  it("returns false for empty pack", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
    };

    expect(isSectionBasedPack(pack)).toBe(false);
  });
});

describe("isRuleBasedPack", () => {
  it("returns true for pack with rules", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*"],
        },
      ],
    };

    expect(isRuleBasedPack(pack)).toBe(true);
  });

  it("returns false for pack with only sections", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test",
          level: 2,
          content: "Content",
          fingerprint: "test-abc",
        },
      ],
    };

    expect(isRuleBasedPack(pack)).toBe(false);
  });
});

describe("getSections", () => {
  it("returns sections from section-based pack", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Testing",
          level: 2,
          content: "Run tests.",
          fingerprint: "testing-abc",
        },
      ],
    };

    const sections = getSections(pack);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.heading).toBe("Testing");
  });

  it("converts rules to sections for rule-based pack", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "testing.require.tests",
          title: "Require Tests",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "All code must have tests.",
        },
      ],
    };

    const sections = getSections(pack);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.heading).toBe("Require Tests");
    expect(sections[0]!.content).toContain("All code must have tests");
    expect(sections[0]!.fingerprint).toBe("testing.require.tests");
  });

  it("converts rule ID to heading when no title provided", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "testing.require.tests",
          severity: "error",
          applies_to: ["**/*"],
        },
      ],
    };

    const sections = getSections(pack);
    expect(sections[0]!.heading).toBe("Testing Require Tests");
  });

  it("returns empty array for pack with neither rules nor sections", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
    };

    const sections = getSections(pack);
    expect(sections).toHaveLength(0);
  });
});

describe("getRules", () => {
  it("returns rules from rule-based pack", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*"],
        },
      ],
    };

    const rules = getRules(pack);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe("test.rule");
  });

  it("returns empty array for section-based pack", () => {
    const pack: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test",
          level: 2,
          content: "Content",
          fingerprint: "test-abc",
        },
      ],
    };

    const rules = getRules(pack);
    expect(rules).toHaveLength(0);
  });
});
