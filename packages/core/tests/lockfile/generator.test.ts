import { describe, it, expect } from "vitest";
import { generateLockfile, hashRule } from "../../src/lockfile/generator.js";
import type { AlignPack, AlignRule } from "@aligntrue/schema";

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

  describe("base_hash field (Phase 3.5 prep)", () => {
    it("captures base_hash from git sources (source_sha)", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const entry = lockfile.rules[0];

      expect(entry.base_hash).toBeDefined();
      expect(entry.base_hash).toBe("abc123"); // Same as source_sha
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

    it("preserves base_hash through round-trip serialization", () => {
      const lockfile = generateLockfile(mockPack, "team");

      // Serialize to JSON
      const json = JSON.stringify(lockfile);
      const parsed = JSON.parse(json);

      // Verify base_hash preserved
      expect(parsed.rules[0].base_hash).toBe("abc123");
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
});
