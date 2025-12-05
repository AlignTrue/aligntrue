import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readLockfile,
  writeLockfile,
  generateLockfile,
  validateLockfile,
  enforceLockfile,
} from "../../src/lockfile/index.js";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import type { RuleFile } from "../../src/rules/file-io.js";
import { computeHash } from "@aligntrue/schema";

describe("lockfile integration", () => {
  const testDir = join(
    process.cwd(),
    "packages/core/tests/lockfile/temp-integration",
  );
  const lockfilePath = join(testDir, ".aligntrue/lock.json");
  const rulesDir = join(testDir, ".aligntrue/rules");

  // Helper to create mock rule files
  function createMockRule(name: string, content: string): RuleFile {
    return {
      filename: `${name}.md`,
      content,
      hash: computeHash(content),
      frontmatter: {},
    };
  }

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(rulesDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("end-to-end workflow", () => {
    it("generates lockfile from rules", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nTest content"),
      ];

      const lockfile = generateLockfile(rules, testDir);
      writeLockfile(lockfilePath, lockfile);

      expect(existsSync(lockfilePath)).toBe(true);

      const read = readLockfile(lockfilePath);
      expect(read).not.toBeNull();
      expect(read?.version).toBe("2");
      expect(read?.bundle_hash).toBeDefined();
    });

    it("validates matching lockfile", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nTest content"),
      ];

      const lockfile = generateLockfile(rules, testDir);
      writeLockfile(lockfilePath, lockfile);

      // Generate current hash
      const currentLockfile = generateLockfile(rules, testDir);

      const validation = validateLockfile(
        lockfile,
        currentLockfile.bundle_hash,
      );
      const enforcement = enforceLockfile("soft", validation);

      expect(validation.valid).toBe(true);
      expect(enforcement.success).toBe(true);
      expect(enforcement.exitCode).toBe(0);
    });

    it("detects drift and enforces based on mode", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nOriginal content"),
      ];

      const lockfile = generateLockfile(rules, testDir);
      writeLockfile(lockfilePath, lockfile);

      // Modify rules
      const modifiedRules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nModified content"),
      ];
      const currentLockfile = generateLockfile(modifiedRules, testDir);

      // Validate should detect mismatch
      const validation = validateLockfile(
        lockfile,
        currentLockfile.bundle_hash,
      );
      expect(validation.valid).toBe(false);

      // Soft mode allows continuation
      const softEnforcement = enforceLockfile("soft", validation);
      expect(softEnforcement.success).toBe(true);
      expect(softEnforcement.exitCode).toBe(0);

      // Strict mode blocks
      const strictEnforcement = enforceLockfile("strict", validation);
      expect(strictEnforcement.success).toBe(false);
      expect(strictEnforcement.exitCode).toBe(1);
    });

    it("handles new rules", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nTest content"),
      ];

      const lockfile = generateLockfile(rules, testDir);
      writeLockfile(lockfilePath, lockfile);

      const rulesWithNew: RuleFile[] = [
        ...rules,
        createMockRule("new-rule", "# New Rule\n\nNew content"),
      ];
      const currentLockfile = generateLockfile(rulesWithNew, testDir);

      const validation = validateLockfile(
        lockfile,
        currentLockfile.bundle_hash,
      );
      expect(validation.valid).toBe(false);
    });

    it("handles deleted rules", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nTest content"),
        createMockRule("to-delete", "# To Delete\n\nDelete content"),
      ];

      const lockfile = generateLockfile(rules, testDir);
      writeLockfile(lockfilePath, lockfile);

      const rulesWithDeleted: RuleFile[] = [rules[0]];
      const currentLockfile = generateLockfile(rulesWithDeleted, testDir);

      const validation = validateLockfile(
        lockfile,
        currentLockfile.bundle_hash,
      );
      expect(validation.valid).toBe(false);
    });

    it("regenerates lockfile after changes", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nOriginal content"),
      ];

      // Initial lockfile
      const lockfile1 = generateLockfile(rules, testDir);
      writeLockfile(lockfilePath, lockfile1);

      // Modify rules and regenerate
      const modifiedRules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nModified content"),
      ];
      const lockfile2 = generateLockfile(modifiedRules, testDir);
      writeLockfile(lockfilePath, lockfile2);

      // New lockfile should validate against modified rules
      const currentLockfile = generateLockfile(modifiedRules, testDir);
      const validation = validateLockfile(
        lockfile2,
        currentLockfile.bundle_hash,
      );
      expect(validation.valid).toBe(true);

      // But not against original rules
      const originalLockfile = generateLockfile(rules, testDir);
      const validation2 = validateLockfile(
        lockfile2,
        originalLockfile.bundle_hash,
      );
      expect(validation2.valid).toBe(false);
    });

    it("excludes personal rules from lockfile", () => {
      const teamRule = createMockRule("team", "# Team Rule\n\nTeam content");
      const personalRule: RuleFile = {
        filename: "personal.md",
        content: "# Personal Rule\n\nPersonal content",
        hash: computeHash("# Personal Rule\n\nPersonal content"),
        frontmatter: { scope: "personal" },
      };

      const rules: RuleFile[] = [teamRule, personalRule];

      // First lockfile with both rules
      const lockfile1 = generateLockfile(rules, testDir);

      // Modify personal rule only
      const modifiedPersonalRule: RuleFile = {
        filename: "personal.md",
        content: "# Personal Rule\n\nModified personal content",
        hash: computeHash("# Personal Rule\n\nModified personal content"),
        frontmatter: { scope: "personal" },
      };

      const rulesWithModifiedPersonal: RuleFile[] = [
        teamRule,
        modifiedPersonalRule,
      ];
      const lockfile2 = generateLockfile(rulesWithModifiedPersonal, testDir);

      // Lockfiles should be identical (personal rule excluded)
      expect(lockfile1.bundle_hash).toBe(lockfile2.bundle_hash);
    });
  });

  describe("team config inclusion", () => {
    it("includes team config in bundle hash", () => {
      const rules: RuleFile[] = [
        createMockRule("test", "# Test Rule\n\nTest content"),
      ];

      // Create team config
      const teamConfigPath = join(testDir, ".aligntrue/config.team.yaml");
      writeFileSync(teamConfigPath, "mode: team\nmodules:\n  lockfile: true");

      const lockfile1 = generateLockfile(rules, testDir);

      // Modify team config
      writeFileSync(
        teamConfigPath,
        "mode: team\nmodules:\n  lockfile: true\n# Added comment",
      );

      const lockfile2 = generateLockfile(rules, testDir);

      // Bundle hashes should differ
      expect(lockfile1.bundle_hash).not.toBe(lockfile2.bundle_hash);
    });
  });
});
