import { describe, it, expect } from "vitest";
import {
  generateLockfile,
  hashRule,
  hashSection,
} from "../../src/lockfile/generator.js";
import type { AlignPack, AlignRule, AlignSection } from "@aligntrue/schema";

describe("lockfile generator", () => {
  const mockRule: AlignRule = {
    id: "test.rule.one",
    severity: "error",
    applies_to: ["*.ts"],
    guidance: "Test rule guidance",
  };

  const mockPack: AlignPack = {
    id: "test.pack",
    version: "1.0.0",
    spec_version: "1",
    summary: "Test pack",
    owner: "test-org",
    source: "https://github.com/test-org/aligns",
    source_sha: "abc123",
    rules: [mockRule],
  };

  describe("generateLockfile", () => {
    it("generates lockfile with correct structure", () => {
      const lockfile = generateLockfile(mockPack, "team");

      expect(lockfile.version).toBe("1");
      expect(lockfile.mode).toBe("team");
      expect(lockfile.rules).toHaveLength(1);
      expect(lockfile.bundle_hash).toBeDefined();
      expect(lockfile.generated_at).toBeDefined();
    });

    it("includes per-rule hashes", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const entry = lockfile.rules[0];

      expect(entry.rule_id).toBe("test.rule.one");
      expect(entry.content_hash).toBeDefined();
      expect(entry.content_hash).toHaveLength(64); // SHA-256 hex
      expect(entry.source).toBe("https://github.com/test-org/aligns");
    });

    it("generates deterministic hashes", () => {
      const lockfile1 = generateLockfile(mockPack, "team");
      const lockfile2 = generateLockfile(mockPack, "team");

      expect(lockfile1.rules[0].content_hash).toBe(
        lockfile2.rules[0].content_hash,
      );
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("generates different hashes for different rules", () => {
      const pack1: AlignPack = {
        ...mockPack,
        rules: [{ ...mockRule, id: "test.rule.one" }],
      };
      const pack2: AlignPack = {
        ...mockPack,
        rules: [{ ...mockRule, id: "test.rule.two" }],
      };

      const lockfile1 = generateLockfile(pack1, "team");
      const lockfile2 = generateLockfile(pack2, "team");

      expect(lockfile1.rules[0].content_hash).not.toBe(
        lockfile2.rules[0].content_hash,
      );
    });

    it("sorts rules by ID for determinism", () => {
      const pack: AlignPack = {
        ...mockPack,
        rules: [
          { ...mockRule, id: "z.last" },
          { ...mockRule, id: "a.first" },
          { ...mockRule, id: "m.middle" },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules[0].rule_id).toBe("a.first");
      expect(lockfile.rules[1].rule_id).toBe("m.middle");
      expect(lockfile.rules[2].rule_id).toBe("z.last");
    });

    it("handles multiple rules", () => {
      const pack: AlignPack = {
        ...mockPack,
        rules: [
          { ...mockRule, id: "test.rule.one" },
          { ...mockRule, id: "test.rule.two" },
          { ...mockRule, id: "test.rule.three" },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules).toHaveLength(3);
      expect(lockfile.bundle_hash).toBeDefined();
    });
  });

  describe("hashRule", () => {
    it("generates SHA-256 hash", () => {
      const hash = hashRule(mockRule);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 hex is 64 chars
    });

    it("is deterministic", () => {
      const hash1 = hashRule(mockRule);
      const hash2 = hashRule(mockRule);

      expect(hash1).toBe(hash2);
    });

    it("changes with rule content", () => {
      const rule1 = { ...mockRule, guidance: "Original guidance" };
      const rule2 = { ...mockRule, guidance: "Modified guidance" };

      const hash1 = hashRule(rule1);
      const hash2 = hashRule(rule2);

      expect(hash1).not.toBe(hash2);
    });

    it("excludes vendor.volatile fields", () => {
      const rule1: AlignRule = {
        ...mockRule,
        vendor: {
          cursor: { stable: "value" },
          _meta: { volatile: ["cursor.session_id"] },
        },
      };

      const rule2: AlignRule = {
        ...mockRule,
        vendor: {
          cursor: { stable: "value", session_id: "abc123" },
          _meta: { volatile: ["cursor.session_id"] },
        },
      };

      // Hashes should be identical (volatile field excluded)
      const hash1 = hashRule(rule1);
      const hash2 = hashRule(rule2);

      expect(hash1).toBe(hash2);
    });

    it("includes non-volatile vendor fields", () => {
      const rule1: AlignRule = {
        ...mockRule,
        vendor: { cursor: { hint: "original" } },
      };

      const rule2: AlignRule = {
        ...mockRule,
        vendor: { cursor: { hint: "modified" } },
      };

      // Hashes should differ (non-volatile field changed)
      const hash1 = hashRule(rule1);
      const hash2 = hashRule(rule2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("bundle hash stability", () => {
    it("generates same bundle hash for same rules regardless of order", () => {
      const pack1: AlignPack = {
        ...mockPack,
        rules: [
          { ...mockRule, id: "a.first" },
          { ...mockRule, id: "z.last" },
        ],
      };

      const pack2: AlignPack = {
        ...mockPack,
        rules: [
          { ...mockRule, id: "z.last" },
          { ...mockRule, id: "a.first" },
        ],
      };

      const lockfile1 = generateLockfile(pack1, "team");
      const lockfile2 = generateLockfile(pack2, "team");

      // Bundle hash should be identical (rules are sorted)
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("changes bundle hash when rule content changes", () => {
      const pack1: AlignPack = {
        ...mockPack,
        rules: [{ ...mockRule, guidance: "Original" }],
      };

      const pack2: AlignPack = {
        ...mockPack,
        rules: [{ ...mockRule, guidance: "Modified" }],
      };

      const lockfile1 = generateLockfile(pack1, "team");
      const lockfile2 = generateLockfile(pack2, "team");

      expect(lockfile1.bundle_hash).not.toBe(lockfile2.bundle_hash);
    });
  });

  describe("base_hash field (Overlays system)", () => {
    it("captures base_hash from git sources (source_sha)", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const entry = lockfile.rules[0];

      expect(entry.base_hash).toBeUndefined(); // No basePack provided
    });

    it("omits base_hash when source_sha is undefined", () => {
      const packWithoutSha: AlignPack = {
        ...mockPack,
        source_sha: undefined,
      };

      const lockfile = generateLockfile(packWithoutSha, "team");
      const entry = lockfile.rules[0];

      expect(entry.base_hash).toBeUndefined();
    });

    it("omits base_hash for local sources (no source_sha)", () => {
      const localPack: AlignPack = {
        id: "local.pack",
        version: "1.0.0",
        spec_version: "1",
        summary: "Local pack",
        rules: [mockRule],
        // No source or source_sha
      };

      const lockfile = generateLockfile(localPack, "team");
      const entry = lockfile.rules[0];

      expect(entry.base_hash).toBeUndefined();
      expect(entry.source).toBeUndefined();
      expect(entry.source_sha).toBeUndefined();
    });

    it("base_hash is optional and does not break existing lockfiles", () => {
      // Simulate an old lockfile without base_hash
      const lockfile = generateLockfile(mockPack, "team");
      const entry = lockfile.rules[0];

      // Remove base_hash to simulate old lockfile
      if (entry) {
        delete (entry as any).base_hash;
      }

      // Should still be valid
      expect(entry?.rule_id).toBeDefined();
      expect(entry?.content_hash).toBeDefined();
      expect(entry?.base_hash).toBeUndefined();
    });
  });

  describe("triple-hash format (Overlays system)", () => {
    const basePack: AlignPack = {
      id: "test.pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Base pack",
      rules: [mockRule],
    };

    const modifiedRule: AlignRule = {
      ...mockRule,
      severity: "warn", // Modified from base
    };

    const modifiedPack: AlignPack = {
      ...basePack,
      rules: [modifiedRule],
    };

    const overlays = [
      {
        selector: 'rule[id="test.rule.one"]',
        set: { severity: "warn" },
      },
    ];

    it("generates triple-hash when overlays and basePack provided", () => {
      const lockfile = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );
      const entry = lockfile.rules[0];

      expect(entry.base_hash).toBeDefined();
      expect(entry.overlay_hash).toBeDefined();
      expect(entry.result_hash).toBeDefined();
      expect(entry.content_hash).toBe(entry.result_hash); // Alias
    });

    it("base_hash matches hash of base rule", () => {
      const lockfile = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );
      const entry = lockfile.rules[0];

      // Verify base_hash exists and is a valid hash
      expect(entry.base_hash).toBeDefined();
      expect(entry.base_hash).toHaveLength(64); // SHA-256 hex
      // base_hash should be different from result_hash (rule was modified)
      expect(entry.base_hash).not.toBe(entry.result_hash);
    });

    it("result_hash matches hash of modified rule", () => {
      const lockfile = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );
      const entry = lockfile.rules[0];

      // Verify result_hash exists and is a valid hash
      expect(entry.result_hash).toBeDefined();
      expect(entry.result_hash).toHaveLength(64); // SHA-256 hex
      // result_hash should equal content_hash
      expect(entry.result_hash).toBe(entry.content_hash);
      // result_hash should be different from base_hash (rule was modified)
      expect(entry.result_hash).not.toBe(entry.base_hash);
    });

    it("overlay_hash is deterministic for same overlays", () => {
      const lockfile1 = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );
      const lockfile2 = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );

      expect(lockfile1.rules[0].overlay_hash).toBe(
        lockfile2.rules[0].overlay_hash,
      );
    });

    it("overlay_hash changes when overlay config changes", () => {
      const overlays2 = [
        {
          selector: 'rule[id="test.rule.one"]',
          set: { severity: "info" }, // Different value
        },
      ];

      const lockfile1 = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );
      const lockfile2 = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays2,
        basePack,
      );

      expect(lockfile1.rules[0].overlay_hash).not.toBe(
        lockfile2.rules[0].overlay_hash,
      );
    });

    it("omits triple-hash when no overlays provided", () => {
      const lockfile = generateLockfile(modifiedPack, "team");
      const entry = lockfile.rules[0];

      expect(entry.overlay_hash).toBeUndefined();
      expect(entry.result_hash).toBeUndefined();
      expect(entry.base_hash).toBeUndefined();
    });

    it("omits base_hash when basePack not provided", () => {
      const lockfile = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
      );
      const entry = lockfile.rules[0];

      expect(entry.base_hash).toBeUndefined();
      expect(entry.overlay_hash).toBeDefined(); // Overlay hash still present
      expect(entry.result_hash).toBeDefined();
    });

    it("handles multiple rules with overlays", () => {
      const multiRulePack: AlignPack = {
        ...basePack,
        rules: [
          { ...mockRule, id: "rule.one", severity: "warn" },
          { ...mockRule, id: "rule.two", severity: "info" },
        ],
      };

      const multiRuleBase: AlignPack = {
        ...basePack,
        rules: [
          { ...mockRule, id: "rule.one", severity: "error" },
          { ...mockRule, id: "rule.two", severity: "error" },
        ],
      };

      const multiOverlays = [
        { selector: 'rule[id="rule.one"]', set: { severity: "warn" } },
        { selector: 'rule[id="rule.two"]', set: { severity: "info" } },
      ];

      const lockfile = generateLockfile(
        multiRulePack,
        "team",
        undefined,
        multiOverlays,
        multiRuleBase,
      );

      expect(lockfile.rules).toHaveLength(2);
      lockfile.rules.forEach((entry) => {
        expect(entry.base_hash).toBeDefined();
        expect(entry.overlay_hash).toBeDefined();
        expect(entry.result_hash).toBeDefined();
      });

      // All rules share same overlay_hash (same overlay config)
      expect(lockfile.rules[0].overlay_hash).toBe(
        lockfile.rules[1].overlay_hash,
      );
    });

    it("backward compatible: content_hash equals result_hash when present", () => {
      const lockfile = generateLockfile(
        modifiedPack,
        "team",
        undefined,
        overlays,
        basePack,
      );
      const entry = lockfile.rules[0];

      expect(entry.content_hash).toBe(entry.result_hash);
    });
  });

  describe("computeOverlayHash", () => {
    it("is exported and callable", async () => {
      const { computeOverlayHash } = await import(
        "../../src/lockfile/generator.js"
      );
      expect(computeOverlayHash).toBeDefined();
    });

    it("generates deterministic hash", async () => {
      const { computeOverlayHash } = await import(
        "../../src/lockfile/generator.js"
      );
      const overlays = [
        { selector: 'rule[id="test"]', set: { severity: "warn" } },
      ];

      const hash1 = computeOverlayHash(overlays);
      const hash2 = computeOverlayHash(overlays);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256
    });

    it("sorts overlays by selector for determinism", async () => {
      const { computeOverlayHash } = await import(
        "../../src/lockfile/generator.js"
      );

      const overlays1 = [
        { selector: 'rule[id="b"]', set: { severity: "warn" } },
        { selector: 'rule[id="a"]', set: { severity: "info" } },
      ];

      const overlays2 = [
        { selector: 'rule[id="a"]', set: { severity: "info" } },
        { selector: 'rule[id="b"]', set: { severity: "warn" } },
      ];

      const hash1 = computeOverlayHash(overlays1);
      const hash2 = computeOverlayHash(overlays2);

      expect(hash1).toBe(hash2); // Order-independent
    });
  });

  // Team mode enhancements: Section-based lockfile tests
  describe("section-based lockfiles", () => {
    const mockSection: AlignSection = {
      heading: "Testing Guidelines",
      level: 2,
      content: "Write comprehensive tests for all features.",
      fingerprint: "fp:testing-guidelines-abc123",
    };

    const mockSectionPack: AlignPack = {
      id: "test.section.pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Test section pack",
      owner: "test-org",
      source: "https://github.com/test-org/aligns",
      source_sha: "def456",
      sections: [mockSection],
    };

    it("generates lockfile from section-based pack", () => {
      const lockfile = generateLockfile(mockSectionPack, "team");

      expect(lockfile.version).toBe("1");
      expect(lockfile.mode).toBe("team");
      expect(lockfile.rules).toHaveLength(1);
      expect(lockfile.bundle_hash).toBeDefined();
      expect(lockfile.generated_at).toBeDefined();
    });

    it("uses section fingerprint as rule_id in lockfile", () => {
      const lockfile = generateLockfile(mockSectionPack, "team");
      const entry = lockfile.rules[0];

      expect(entry.rule_id).toBe("fp:testing-guidelines-abc123");
      expect(entry.content_hash).toBeDefined();
      expect(entry.content_hash).toHaveLength(64); // SHA-256 hex
      expect(entry.source).toBe("https://github.com/test-org/aligns");
    });

    it("generates deterministic hashes for sections", () => {
      const lockfile1 = generateLockfile(mockSectionPack, "team");
      const lockfile2 = generateLockfile(mockSectionPack, "team");

      expect(lockfile1.rules[0].content_hash).toBe(
        lockfile2.rules[0].content_hash,
      );
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("generates different hashes for different sections", () => {
      const pack1: AlignPack = {
        ...mockSectionPack,
        sections: [{ ...mockSection, content: "Content A" }],
      };
      const pack2: AlignPack = {
        ...mockSectionPack,
        sections: [{ ...mockSection, content: "Content B" }],
      };

      const lockfile1 = generateLockfile(pack1, "team");
      const lockfile2 = generateLockfile(pack2, "team");

      expect(lockfile1.rules[0].content_hash).not.toBe(
        lockfile2.rules[0].content_hash,
      );
    });

    it("sorts sections by fingerprint for determinism", () => {
      const pack: AlignPack = {
        ...mockSectionPack,
        sections: [
          { ...mockSection, fingerprint: "fp:z-last" },
          { ...mockSection, fingerprint: "fp:a-first" },
          { ...mockSection, fingerprint: "fp:m-middle" },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules[0].rule_id).toBe("fp:a-first");
      expect(lockfile.rules[1].rule_id).toBe("fp:m-middle");
      expect(lockfile.rules[2].rule_id).toBe("fp:z-last");
    });

    it("handles multiple sections", () => {
      const pack: AlignPack = {
        ...mockSectionPack,
        sections: [
          { ...mockSection, fingerprint: "fp:one" },
          { ...mockSection, fingerprint: "fp:two" },
          { ...mockSection, fingerprint: "fp:three" },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules).toHaveLength(3);
      expect(lockfile.rules[0].rule_id).toBe("fp:one");
      expect(lockfile.rules[1].rule_id).toBe("fp:three");
      expect(lockfile.rules[2].rule_id).toBe("fp:two");
    });

    it("hashSection generates deterministic hashes", () => {
      const hash1 = hashSection(mockSection);
      const hash2 = hashSection(mockSection);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it("hashSection changes when content changes", () => {
      const section1 = { ...mockSection, content: "Content A" };
      const section2 = { ...mockSection, content: "Content B" };

      const hash1 = hashSection(section1);
      const hash2 = hashSection(section2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
