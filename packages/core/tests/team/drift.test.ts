/**
 * Tests for drift detection including merge conflict detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { detectDrift } from "../../src/team/drift.js";

describe("drift detection", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique test directory
    const tmpBase = join(process.cwd(), "tests/tmp");
    if (!existsSync(tmpBase)) {
      mkdirSync(tmpBase, { recursive: true });
    }
    testDir = mkdtempSync(join(tmpBase, "drift-test-"));
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("merge conflict detection", () => {
    it("should detect conflict markers in lockfile", async () => {
      // Create .aligntrue directory
      mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
      mkdirSync(join(testDir, ".aligntrue/rules"), { recursive: true });

      // Create a lockfile with conflict markers
      const lockfileContent = `{
  "version": "1",
<<<<<<< HEAD
  "bundle_hash": "abc123",
=======
  "bundle_hash": "def456",
>>>>>>> feature-branch
  "rules": []
}`;
      writeFileSync(
        join(testDir, ".aligntrue/lock.json"),
        lockfileContent,
        "utf-8",
      );

      // Create a minimal rule file
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test rule\n\nSome content.",
        "utf-8",
      );

      const result = await detectDrift(
        join(testDir, ".aligntrue/lock.json"),
        testDir,
      );

      expect(result.has_drift).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings.some((f) => f.category === "conflict")).toBe(true);
      expect(result.summary.by_category.conflict).toBeGreaterThan(0);
    });

    it("should detect conflict markers in rule files", async () => {
      // Create .aligntrue directory
      mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
      mkdirSync(join(testDir, ".aligntrue/rules"), { recursive: true });

      // Create valid lockfile
      const lockfile = {
        version: "1",
        bundle_hash: "test-hash",
        generated_at: new Date().toISOString(),
        rules: [],
      };
      writeFileSync(
        join(testDir, ".aligntrue/lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );

      // Create a rule file with conflict markers
      const ruleContent = `---
title: Test Rule
---

# Test Rule

<<<<<<< HEAD
Use approach A.
=======
Use approach B.
>>>>>>> feature-branch
`;
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        ruleContent,
        "utf-8",
      );

      const result = await detectDrift(
        join(testDir, ".aligntrue/lock.json"),
        testDir,
      );

      expect(result.has_drift).toBe(true);
      expect(result.findings.some((f) => f.category === "conflict")).toBe(true);
    });

    it("should not report conflicts when no markers present", async () => {
      // Create .aligntrue directory
      mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
      mkdirSync(join(testDir, ".aligntrue/rules"), { recursive: true });

      // Create valid lockfile
      const lockfile = {
        version: "1",
        bundle_hash: "test-hash",
        generated_at: new Date().toISOString(),
        rules: [],
      };
      writeFileSync(
        join(testDir, ".aligntrue/lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );

      // Create clean rule file
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test rule\n\nSome content.",
        "utf-8",
      );

      const result = await detectDrift(
        join(testDir, ".aligntrue/lock.json"),
        testDir,
      );

      // Should have lockfile drift (hash mismatch) but no conflict
      expect(result.findings.every((f) => f.category !== "conflict")).toBe(
        true,
      );
      expect(result.summary.by_category.conflict).toBe(0);
    });

    it("should detect git unmerged files in .aligntrue", async () => {
      const git = (args: string[]) =>
        execFileSync("git", args, {
          cwd: testDir,
          stdio: "pipe",
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: "Test User",
            GIT_AUTHOR_EMAIL: "test@example.com",
            GIT_COMMITTER_NAME: "Test User",
            GIT_COMMITTER_EMAIL: "test@example.com",
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_TERMINAL_PROMPT: "0",
          },
        });

      // Initialize git repo
      git(["init"]);
      // Force branch name to main
      try {
        git(["checkout", "-b", "main"]);
      } catch {
        // Already on main or old git version
      }

      // Create .aligntrue directory
      mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
      mkdirSync(join(testDir, ".aligntrue/rules"), { recursive: true });

      // Create initial files and commit
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test\n\nOriginal.",
        "utf-8",
      );
      const lockfile = {
        version: "1",
        bundle_hash: "initial",
        generated_at: new Date().toISOString(),
        rules: [],
      };
      writeFileSync(
        join(testDir, ".aligntrue/lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );
      git(["add", "."]);
      git(["commit", "-m", "Initial", "--no-gpg-sign"]);

      // Create branch and make change
      git(["checkout", "-b", "feature"]);
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test\n\nFeature change.",
        "utf-8",
      );
      git(["add", "."]);
      git(["commit", "-m", "Feature", "--no-gpg-sign"]);

      // Go back to main and make conflicting change
      git(["checkout", "main"]);
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test\n\nMain change.",
        "utf-8",
      );
      git(["add", "."]);
      git(["commit", "-m", "Main", "--no-gpg-sign"]);

      // Try to merge (will conflict)
      try {
        git(["merge", "--no-edit", "--no-gpg-sign", "feature"]);
      } catch {
        // Expected to fail due to conflict
      }

      const result = await detectDrift(
        join(testDir, ".aligntrue/lock.json"),
        testDir,
      );

      expect(result.has_drift).toBe(true);
      expect(result.findings.some((f) => f.category === "conflict")).toBe(true);
    }, 30000);
  });
});
