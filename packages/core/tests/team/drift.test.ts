/**
 * Tests for drift detection including merge conflict detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { detectDrift } from "../../src/team/drift.js";

describe("drift detection", () => {
  const testDir = join(process.cwd(), "tests/tmp/drift-test");

  beforeEach(() => {
    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
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
      // Initialize git repo
      execFileSync("git", ["init"], { cwd: testDir, stdio: "pipe" });
      execFileSync("git", ["config", "user.email", "test@example.com"], {
        cwd: testDir,
        stdio: "pipe",
      });
      execFileSync("git", ["config", "user.name", "Test User"], {
        cwd: testDir,
        stdio: "pipe",
      });

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
      execFileSync("git", ["add", "."], { cwd: testDir, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "Initial"], {
        cwd: testDir,
        stdio: "pipe",
      });

      // Create branch and make change
      execFileSync("git", ["checkout", "-b", "feature"], {
        cwd: testDir,
        stdio: "pipe",
      });
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test\n\nFeature change.",
        "utf-8",
      );
      execFileSync("git", ["add", "."], { cwd: testDir, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "Feature"], {
        cwd: testDir,
        stdio: "pipe",
      });

      // Go back to main and make conflicting change
      execFileSync("git", ["checkout", "master"], {
        cwd: testDir,
        stdio: "pipe",
      });
      writeFileSync(
        join(testDir, ".aligntrue/rules/test.md"),
        "# Test\n\nMain change.",
        "utf-8",
      );
      execFileSync("git", ["add", "."], { cwd: testDir, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "Main"], {
        cwd: testDir,
        stdio: "pipe",
      });

      // Try to merge (will conflict)
      try {
        execFileSync("git", ["merge", "feature"], {
          cwd: testDir,
          stdio: "pipe",
        });
      } catch {
        // Expected to fail due to conflict
      }

      const result = await detectDrift(
        join(testDir, ".aligntrue/lock.json"),
        testDir,
      );

      expect(result.has_drift).toBe(true);
      expect(result.findings.some((f) => f.category === "conflict")).toBe(true);
    });
  });
});
