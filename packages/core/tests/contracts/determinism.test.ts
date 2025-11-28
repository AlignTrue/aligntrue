/**
 * Determinism contract tests
 *
 * Verifies the core promise: "Identical inputs produce identical bundles, hashes, and exports"
 *
 * These tests ensure that:
 * 1. Lockfile generation is idempotent
 * 2. Bundle hashes are stable across runs
 * 3. Key ordering is deterministic
 * 4. Timestamps don't affect content hashes
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import type { Align, AlignSection } from "@aligntrue/schema";
import { computeContentHash, computeHash } from "@aligntrue/schema";
import {
  generateLockfile,
  generateLockfileFromRules,
  hashSection,
} from "../../src/lockfile/generator.js";
import { parseRuleFile, loadRulesDirectory } from "../../src/rules/file-io.js";

const TEST_DIR = join(
  process.cwd(),
  "packages/core/tests/contracts/temp-determinism",
);

describe("Determinism Contracts", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("Lockfile Generation Idempotency", () => {
    it("generates identical lockfiles from identical Align inputs", () => {
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            heading: "Rule One",
            level: 2,
            content: "First rule content",
            fingerprint: "rule-one",
          },
          {
            heading: "Rule Two",
            level: 2,
            content: "Second rule content",
            fingerprint: "rule-two",
          },
        ],
      };

      const lockfile1 = generateLockfile(align, "team");
      const lockfile2 = generateLockfile(align, "team");

      // Bundle hashes must be identical
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);

      // Rule hashes must be identical
      expect(lockfile1.rules.length).toBe(lockfile2.rules.length);
      for (let i = 0; i < lockfile1.rules.length; i++) {
        expect(lockfile1.rules[i].content_hash).toBe(
          lockfile2.rules[i].content_hash,
        );
        expect(lockfile1.rules[i].rule_id).toBe(lockfile2.rules[i].rule_id);
      }

      // Timestamps may differ but content hashes should not
      expect(lockfile1.bundle_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates identical lockfiles regardless of section order in input", () => {
      const sectionsA: AlignSection[] = [
        {
          heading: "Alpha",
          level: 2,
          content: "A content",
          fingerprint: "alpha",
        },
        {
          heading: "Beta",
          level: 2,
          content: "B content",
          fingerprint: "beta",
        },
        {
          heading: "Gamma",
          level: 2,
          content: "G content",
          fingerprint: "gamma",
        },
      ];

      const sectionsB: AlignSection[] = [
        {
          heading: "Gamma",
          level: 2,
          content: "G content",
          fingerprint: "gamma",
        },
        {
          heading: "Alpha",
          level: 2,
          content: "A content",
          fingerprint: "alpha",
        },
        {
          heading: "Beta",
          level: 2,
          content: "B content",
          fingerprint: "beta",
        },
      ];

      const alignA: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: sectionsA,
      };
      const alignB: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: sectionsB,
      };

      const lockfileA = generateLockfile(alignA, "team");
      const lockfileB = generateLockfile(alignB, "team");

      // Bundle hashes must be identical regardless of input order
      expect(lockfileA.bundle_hash).toBe(lockfileB.bundle_hash);

      // Rules should be sorted by rule_id (fingerprint)
      expect(lockfileA.rules[0].rule_id).toBe("alpha");
      expect(lockfileA.rules[1].rule_id).toBe("beta");
      expect(lockfileA.rules[2].rule_id).toBe("gamma");
    });

    it("produces different hashes for different content", () => {
      const alignA: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            heading: "Rule",
            level: 2,
            content: "Content A",
            fingerprint: "rule",
          },
        ],
      };

      const alignB: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            heading: "Rule",
            level: 2,
            content: "Content B",
            fingerprint: "rule",
          },
        ],
      };

      const lockfileA = generateLockfile(alignA, "team");
      const lockfileB = generateLockfile(alignB, "team");

      expect(lockfileA.bundle_hash).not.toBe(lockfileB.bundle_hash);
      expect(lockfileA.rules[0].content_hash).not.toBe(
        lockfileB.rules[0].content_hash,
      );
    });
  });

  describe("Section Hashing Stability", () => {
    it("produces identical hashes for identical sections", () => {
      const section: AlignSection = {
        heading: "Test Rule",
        level: 2,
        content: "Test content for hashing",
        fingerprint: "test-rule",
      };

      const hash1 = hashSection(section);
      const hash2 = hashSection(section);
      const hash3 = hashSection(section);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces identical hashes regardless of key order in section", () => {
      // Create sections with different key orderings
      const sectionA: AlignSection = {
        heading: "Test",
        level: 2,
        content: "Content",
        fingerprint: "test",
        severity: "error",
      };

      // Same data, but constructed differently (keys in different order conceptually)
      const sectionB: AlignSection = Object.assign(
        {},
        { fingerprint: "test" },
        { level: 2 },
        { heading: "Test" },
        { content: "Content" },
        { severity: "error" },
      );

      const hashA = hashSection(sectionA);
      const hashB = hashSection(sectionB);

      expect(hashA).toBe(hashB);
    });

    it("excludes volatile vendor fields from hash", () => {
      const sectionWithVolatile: AlignSection = {
        heading: "Test",
        level: 2,
        content: "Content",
        fingerprint: "test",
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "session-123" },
        },
      };

      const sectionWithDifferentVolatile: AlignSection = {
        heading: "Test",
        level: 2,
        content: "Content",
        fingerprint: "test",
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "session-456" },
        },
      };

      const hash1 = hashSection(sectionWithVolatile);
      const hash2 = hashSection(sectionWithDifferentVolatile);

      // Volatile fields should not affect hash
      expect(hash1).toBe(hash2);
    });

    it("includes non-volatile vendor fields in hash", () => {
      const sectionA: AlignSection = {
        heading: "Test",
        level: 2,
        content: "Content",
        fingerprint: "test",
        vendor: {
          cursor: { ai_hint: "hint-A" },
        },
      };

      const sectionB: AlignSection = {
        heading: "Test",
        level: 2,
        content: "Content",
        fingerprint: "test",
        vendor: {
          cursor: { ai_hint: "hint-B" },
        },
      };

      const hashA = hashSection(sectionA);
      const hashB = hashSection(sectionB);

      // Non-volatile fields should affect hash
      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Rule File Parsing Determinism", () => {
    it("parses same file identically across multiple calls", () => {
      const rulesDir = join(TEST_DIR, "rules");
      mkdirSync(rulesDir, { recursive: true });

      const ruleContent = `---
title: Test Rule
description: A test rule
---

# Test Rule

Follow these guidelines.
`;
      const rulePath = join(rulesDir, "test-rule.md");
      writeFileSync(rulePath, ruleContent, "utf-8");

      const rule1 = parseRuleFile(rulePath, TEST_DIR);
      const rule2 = parseRuleFile(rulePath, TEST_DIR);
      const rule3 = parseRuleFile(rulePath, TEST_DIR);

      expect(rule1.hash).toBe(rule2.hash);
      expect(rule2.hash).toBe(rule3.hash);
      expect(rule1.content).toBe(rule2.content);
      expect(rule1.frontmatter.title).toBe(rule2.frontmatter.title);
    });

    it("generates identical lockfile from rule files", async () => {
      const rulesDir = join(TEST_DIR, "rules");
      mkdirSync(rulesDir, { recursive: true });

      writeFileSync(
        join(rulesDir, "alpha.md"),
        `---
title: Alpha Rule
---

Alpha content.
`,
        "utf-8",
      );

      writeFileSync(
        join(rulesDir, "beta.md"),
        `---
title: Beta Rule
---

Beta content.
`,
        "utf-8",
      );

      const rules1 = await loadRulesDirectory(rulesDir, TEST_DIR);
      const rules2 = await loadRulesDirectory(rulesDir, TEST_DIR);

      const lockfile1 = generateLockfileFromRules(rules1, "team");
      const lockfile2 = generateLockfileFromRules(rules2, "team");

      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
      expect(lockfile1.rules.length).toBe(lockfile2.rules.length);
    });
  });

  describe("Bundle Hash Stability", () => {
    it("produces stable bundle hash from multiple rule hashes", () => {
      const sections: AlignSection[] = [
        { heading: "A", level: 2, content: "A", fingerprint: "a" },
        { heading: "B", level: 2, content: "B", fingerprint: "b" },
        { heading: "C", level: 2, content: "C", fingerprint: "c" },
      ];

      const align: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections,
      };

      // Generate lockfile 10 times
      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const lockfile = generateLockfile(align, "team");
        hashes.push(lockfile.bundle_hash);
      }

      // All hashes should be identical
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
    });

    it("bundle hash changes when any rule changes", () => {
      const sectionsOriginal: AlignSection[] = [
        { heading: "A", level: 2, content: "Original A", fingerprint: "a" },
        { heading: "B", level: 2, content: "Original B", fingerprint: "b" },
      ];

      const sectionsModified: AlignSection[] = [
        { heading: "A", level: 2, content: "Original A", fingerprint: "a" },
        { heading: "B", level: 2, content: "Modified B", fingerprint: "b" },
      ];

      const alignOriginal: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: sectionsOriginal,
      };
      const alignModified: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: sectionsModified,
      };

      const lockfileOriginal = generateLockfile(alignOriginal, "team");
      const lockfileModified = generateLockfile(alignModified, "team");

      expect(lockfileOriginal.bundle_hash).not.toBe(
        lockfileModified.bundle_hash,
      );
    });
  });

  describe("Content Hash Computation", () => {
    it("computeContentHash is deterministic for objects", () => {
      const obj = { foo: "bar", nested: { a: 1, b: 2 } };

      const hash1 = computeContentHash(obj);
      const hash2 = computeContentHash(obj);
      const hash3 = computeContentHash(obj);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it("computeContentHash is deterministic for strings", () => {
      const str = "test content for hashing";

      const hash1 = computeContentHash(str);
      const hash2 = computeContentHash(str);

      expect(hash1).toBe(hash2);
    });

    it("computeHash is deterministic", () => {
      const data = "hello world test data";

      const hash1 = computeHash(data);
      const hash2 = computeHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Personal Rules Exclusion", () => {
    it("excludes personal-scoped sections from lockfile", () => {
      const sections: AlignSection[] = [
        {
          heading: "Team Rule",
          level: 2,
          content: "Team",
          fingerprint: "team-rule",
        },
        {
          heading: "Personal Rule",
          level: 2,
          content: "Personal",
          fingerprint: "personal-rule",
          scope: "personal",
        },
      ];

      const align: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections,
      };

      const lockfile = generateLockfile(align, "team");

      // Only team rule should be in lockfile
      expect(lockfile.rules.length).toBe(1);
      expect(lockfile.rules[0].rule_id).toBe("team-rule");
      expect(lockfile.personal_rules_count).toBe(1);
    });

    it("produces same hash regardless of personal rules count", () => {
      const sectionsWithOnePersonal: AlignSection[] = [
        { heading: "Team", level: 2, content: "Team", fingerprint: "team" },
        {
          heading: "Personal 1",
          level: 2,
          content: "P1",
          fingerprint: "p1",
          scope: "personal",
        },
      ];

      const sectionsWithTwoPersonal: AlignSection[] = [
        { heading: "Team", level: 2, content: "Team", fingerprint: "team" },
        {
          heading: "Personal 1",
          level: 2,
          content: "P1",
          fingerprint: "p1",
          scope: "personal",
        },
        {
          heading: "Personal 2",
          level: 2,
          content: "P2",
          fingerprint: "p2",
          scope: "personal",
        },
      ];

      const align1: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: sectionsWithOnePersonal,
      };
      const align2: Align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: sectionsWithTwoPersonal,
      };

      const lockfile1 = generateLockfile(align1, "team");
      const lockfile2 = generateLockfile(align2, "team");

      // Bundle hash should be same (only team rules affect it)
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });
  });

  describe("Multiple Runs Stability", () => {
    it("100 consecutive lockfile generations produce identical results", () => {
      const sections: AlignSection[] = [
        {
          heading: "Rule 1",
          level: 2,
          content: "Content 1",
          fingerprint: "rule-1",
        },
        {
          heading: "Rule 2",
          level: 2,
          content: "Content 2",
          fingerprint: "rule-2",
        },
        {
          heading: "Rule 3",
          level: 2,
          content: "Content 3",
          fingerprint: "rule-3",
        },
      ];

      const align: Align = {
        id: "stability-test",
        version: "1.0.0",
        spec_version: "1",
        sections,
      };

      const results: Array<{ bundleHash: string; ruleHashes: string[] }> = [];

      for (let i = 0; i < 100; i++) {
        const lockfile = generateLockfile(align, "team");
        results.push({
          bundleHash: lockfile.bundle_hash,
          ruleHashes: lockfile.rules.map((r) => r.content_hash),
        });
      }

      // All bundle hashes must be identical
      const bundleHashes = new Set(results.map((r) => r.bundleHash));
      expect(bundleHashes.size).toBe(1);

      // All rule hash arrays must be identical
      const firstRuleHashes = JSON.stringify(results[0].ruleHashes);
      for (const result of results) {
        expect(JSON.stringify(result.ruleHashes)).toBe(firstRuleHashes);
      }
    });
  });
});
