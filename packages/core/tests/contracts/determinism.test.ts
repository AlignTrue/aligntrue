/**
 * Determinism contract tests
 *
 * Verifies the core promise: "Identical inputs produce identical bundles, hashes, and exports"
 *
 * These tests ensure that:
 * 1. Lockfile generation is idempotent
 * 2. Bundle hashes are stable across runs
 * 3. Rule ordering doesn't affect bundle hash
 * 4. Personal rules are excluded from bundle hash
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { computeContentHash, computeHash } from "@aligntrue/schema";
import { generateLockfile } from "../../src/lockfile/generator.js";
import { parseRuleFile, loadRulesDirectory } from "../../src/rules/file-io.js";
import type { RuleFile } from "../../src/rules/file-io.js";

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

  // Helper to create mock rule files
  function createRule(
    name: string,
    content: string,
    frontmatter: Record<string, unknown> = {},
  ): RuleFile {
    return {
      filename: `${name}.md`,
      content,
      hash: computeHash(content),
      frontmatter,
    };
  }

  describe("Lockfile Generation Idempotency", () => {
    it("generates identical lockfiles from identical rule inputs", () => {
      const rules: RuleFile[] = [
        createRule("rule-one", "# Rule One\n\nFirst rule content"),
        createRule("rule-two", "# Rule Two\n\nSecond rule content"),
      ];

      const lockfile1 = generateLockfile(rules, TEST_DIR);
      const lockfile2 = generateLockfile(rules, TEST_DIR);

      // Bundle hashes must be identical
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
      expect(lockfile1.version).toBe("2");
    });

    it("generates identical lockfiles regardless of rule order in input", () => {
      const rulesA: RuleFile[] = [
        createRule("alpha", "# Alpha\n\nA content"),
        createRule("beta", "# Beta\n\nB content"),
        createRule("gamma", "# Gamma\n\nG content"),
      ];

      const rulesB: RuleFile[] = [
        createRule("gamma", "# Gamma\n\nG content"),
        createRule("alpha", "# Alpha\n\nA content"),
        createRule("beta", "# Beta\n\nB content"),
      ];

      const lockfileA = generateLockfile(rulesA, TEST_DIR);
      const lockfileB = generateLockfile(rulesB, TEST_DIR);

      // Bundle hashes must be identical regardless of input order
      expect(lockfileA.bundle_hash).toBe(lockfileB.bundle_hash);
    });

    it("produces different hashes for different content", () => {
      const rulesA: RuleFile[] = [createRule("rule", "# Rule\n\nContent A")];

      const rulesB: RuleFile[] = [createRule("rule", "# Rule\n\nContent B")];

      const lockfileA = generateLockfile(rulesA, TEST_DIR);
      const lockfileB = generateLockfile(rulesB, TEST_DIR);

      expect(lockfileA.bundle_hash).not.toBe(lockfileB.bundle_hash);
    });
  });

  describe("Rule File Hashing", () => {
    it("produces identical hashes for identical rule content", () => {
      const content = "# Test Rule\n\nTest content for hashing";

      const hash1 = computeHash(content);
      const hash2 = computeHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hashes for different content", () => {
      const hash1 = computeHash("Content A");
      const hash2 = computeHash("Content B");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Rule File Parsing Stability", () => {
    it("parses same file identically across multiple calls", async () => {
      const rulesDir = join(TEST_DIR, "rules");
      mkdirSync(rulesDir, { recursive: true });

      const ruleContent = `---
description: Test rule
---

# Test Rule

Test content`;

      writeFileSync(join(rulesDir, "test.md"), ruleContent);

      const parsed1 = parseRuleFile(join(rulesDir, "test.md"), TEST_DIR);
      const parsed2 = parseRuleFile(join(rulesDir, "test.md"), TEST_DIR);

      expect(parsed1.content).toBe(parsed2.content);
      expect(parsed1.hash).toBe(parsed2.hash);
      expect(parsed1.frontmatter).toEqual(parsed2.frontmatter);
    });
  });

  describe("Bundle Hash Stability", () => {
    it("generates identical lockfile from rule files", async () => {
      const rulesDir = join(TEST_DIR, "rules");
      mkdirSync(rulesDir, { recursive: true });

      writeFileSync(
        join(rulesDir, "global.md"),
        "# Global Rules\n\nGlobal content",
      );
      writeFileSync(
        join(rulesDir, "typescript.md"),
        "# TypeScript\n\nTypeScript content",
      );

      const rules1 = await loadRulesDirectory(rulesDir, TEST_DIR);
      const rules2 = await loadRulesDirectory(rulesDir, TEST_DIR);

      const lockfile1 = generateLockfile(rules1, TEST_DIR);
      const lockfile2 = generateLockfile(rules2, TEST_DIR);

      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("produces stable bundle hash from multiple rule hashes", () => {
      const rules: RuleFile[] = [
        createRule("a", "Content A"),
        createRule("b", "Content B"),
        createRule("c", "Content C"),
      ];

      const lockfile = generateLockfile(rules, TEST_DIR);
      expect(lockfile.bundle_hash).toMatch(/^[a-f0-9]{64}$/);

      // Generate again to verify stability
      const lockfile2 = generateLockfile(rules, TEST_DIR);
      expect(lockfile.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("bundle hash changes when any rule changes", () => {
      const rules1: RuleFile[] = [
        createRule("a", "Content A"),
        createRule("b", "Content B"),
      ];

      const rules2: RuleFile[] = [
        createRule("a", "Content A"),
        createRule("b", "Content B modified"),
      ];

      const lockfile1 = generateLockfile(rules1, TEST_DIR);
      const lockfile2 = generateLockfile(rules2, TEST_DIR);

      expect(lockfile1.bundle_hash).not.toBe(lockfile2.bundle_hash);
    });
  });

  describe("Schema Hash Functions", () => {
    it("computeContentHash is deterministic for objects", () => {
      const obj = { a: 1, b: "test", c: [1, 2, 3] };

      const hash1 = computeContentHash(obj, false);
      const hash2 = computeContentHash(obj, false);

      expect(hash1).toBe(hash2);
    });

    it("computeContentHash is deterministic for strings", () => {
      const str = "Test string for hashing";

      const hash1 = computeContentHash(str, false);
      const hash2 = computeContentHash(str, false);

      expect(hash1).toBe(hash2);
    });

    it("computeHash is deterministic", () => {
      const input = "Deterministic input";

      const hash1 = computeHash(input);
      const hash2 = computeHash(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Personal Rules Exclusion", () => {
    it("excludes personal-scoped rules from lockfile", () => {
      const rulesWithPersonal: RuleFile[] = [
        createRule("team-rule", "Team content"),
        createRule("personal-rule", "Personal content", { scope: "personal" }),
      ];

      const rulesWithoutPersonal: RuleFile[] = [
        createRule("team-rule", "Team content"),
      ];

      const lockfile1 = generateLockfile(rulesWithPersonal, TEST_DIR);
      const lockfile2 = generateLockfile(rulesWithoutPersonal, TEST_DIR);

      // Bundle hashes should be identical (personal excluded)
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("produces same hash regardless of personal rules content", () => {
      const teamRule = createRule("team", "Team content");

      const rules1: RuleFile[] = [
        teamRule,
        createRule("personal", "Personal v1", { scope: "personal" }),
      ];

      const rules2: RuleFile[] = [
        teamRule,
        createRule("personal", "Personal v2 - different content", {
          scope: "personal",
        }),
      ];

      const lockfile1 = generateLockfile(rules1, TEST_DIR);
      const lockfile2 = generateLockfile(rules2, TEST_DIR);

      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });
  });

  describe("Consecutive Generation Stability", () => {
    it("100 consecutive lockfile generations produce identical results", () => {
      const rules: RuleFile[] = [
        createRule("rule-a", "Content for rule A"),
        createRule("rule-b", "Content for rule B"),
        createRule("rule-c", "Content for rule C"),
      ];

      const firstLockfile = generateLockfile(rules, TEST_DIR);
      const firstHash = firstLockfile.bundle_hash;

      // Generate 99 more times
      for (let i = 0; i < 99; i++) {
        const lockfile = generateLockfile(rules, TEST_DIR);
        expect(lockfile.bundle_hash).toBe(firstHash);
      }
    });
  });
});
