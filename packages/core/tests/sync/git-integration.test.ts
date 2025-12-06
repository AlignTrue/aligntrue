/**
 * Tests for GitIntegration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { GitIntegration } from "../../src/sync/git-integration.js";

const TEST_DIR = join(
  process.cwd(),
  "packages/core/tests/temp-git-integration",
);

describe("GitIntegration", () => {
  let gitIntegration: GitIntegration;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    gitIntegration = new GitIntegration();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      try {
        rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
    }
  });

  describe("ignore mode", () => {
    it("adds generated files to .gitignore", async () => {
      const files = [".cursor/rules/aligntrue.mdc", "AGENTS.md"];

      const result = await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      });

      expect(result.mode).toBe("ignore");
      expect(result.action).toBe("added to .gitignore");
      expect(result.filesAffected).toEqual(files);

      const gitignorePath = join(TEST_DIR, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(true);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
      expect(content).toContain("AGENTS.md");
    });

    it("is idempotent (does not duplicate entries)", async () => {
      const files = [".cursor/rules/aligntrue.mdc"];

      // First call
      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      });

      // Second call
      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");

      // Count occurrences
      const matches = content.match(/\.cursor\/rules\/aligntrue\.mdc/g);
      expect(matches).toHaveLength(1);
    });

    it("preserves existing .gitignore content", async () => {
      const gitignorePath = join(TEST_DIR, ".gitignore");
      const existingContent = "node_modules/\ndist/\n";
      writeFileSync(gitignorePath, existingContent, "utf-8");

      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc"],
      });

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("node_modules/");
      expect(content).toContain("dist/");
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
    });

    it("normalizes patterns (removes leading ./)", async () => {
      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: ["./.cursor/rules/aligntrue.mdc"],
      });

      const content = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
      expect(content).not.toContain("./.cursor/");
    });
  });

  describe("commit mode", () => {
    beforeEach(() => {
      // Initialize git repo for commit mode tests
      execSync("git init", { cwd: TEST_DIR, stdio: "pipe" });
      execSync('git config user.email "test@example.com"', {
        cwd: TEST_DIR,
        stdio: "pipe",
      });
      execSync('git config user.name "Test User"', {
        cwd: TEST_DIR,
        stdio: "pipe",
      });
    });

    it("stages files for commit", async () => {
      // Create files to stage
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "aligntrue.mdc"), "# Test Rule\n", "utf-8");
      writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Test Agents\n", "utf-8");

      const files = [".cursor/rules/aligntrue.mdc", "AGENTS.md"];

      const result = await gitIntegration.apply({
        mode: "commit",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      });

      expect(result.mode).toBe("commit");
      expect(result.action).toBe("staged files for commit");
      expect(result.filesAffected).toEqual(files);

      // Verify files are staged
      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();
      expect(stagedFiles).toContain("AGENTS.md");
      expect(stagedFiles).toContain(".cursor/rules/aligntrue.mdc");
    });

    it("does not modify .gitignore", async () => {
      const gitignorePath = join(TEST_DIR, ".gitignore");
      const initialContent = "node_modules/\n";
      writeFileSync(gitignorePath, initialContent, "utf-8");

      // Create directory and file to stage
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc"),
        "# Test\n",
        "utf-8",
      );

      await gitIntegration.apply({
        mode: "commit",
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc"],
      });

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toBe(initialContent);
    });

    it("throws error for non-git workspace", async () => {
      const nonGitDir = join(TEST_DIR, "non-git");
      mkdirSync(nonGitDir, { recursive: true });

      await expect(
        gitIntegration.apply({
          mode: "commit",
          workspaceRoot: nonGitDir,
          generatedFiles: ["AGENTS.md"],
        }),
      ).rejects.toThrow(/git repository/);
    });
  });

  describe("branch mode", () => {
    beforeEach(() => {
      // Initialize git repo
      try {
        execSync("git init", { cwd: TEST_DIR, stdio: "pipe" });
        execSync('git config user.email "test@example.com"', {
          cwd: TEST_DIR,
          stdio: "pipe",
        });
        execSync('git config user.name "Test User"', {
          cwd: TEST_DIR,
          stdio: "pipe",
        });

        // Create initial commit
        const readmePath = join(TEST_DIR, "README.md");
        writeFileSync(readmePath, "# Test Repo\n", "utf-8");
        execSync("git add README.md", { cwd: TEST_DIR, stdio: "pipe" });
        execSync('git commit -m "Initial commit"', {
          cwd: TEST_DIR,
          stdio: "pipe",
        });
      } catch {
        // Ignore git setup errors in CI
      }
    }, 20000);

    it("creates feature branch and stages files", async () => {
      // Create files to stage
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "aligntrue.mdc"), "# Test Rule\n", "utf-8");
      writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Test Agents\n", "utf-8");

      const result = await gitIntegration.apply({
        mode: "branch",
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc", "AGENTS.md"],
      });

      expect(result.mode).toBe("branch");
      expect(result.action).toBe("created branch and staged files");
      expect(result.branchCreated).toMatch(
        /^aligntrue\/sync-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}$/,
      );

      // Verify branch was created
      const currentBranch = execSync("git branch --show-current", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();

      expect(currentBranch).toBe(result.branchCreated);
    }, 20000);

    it("accepts custom branch name", async () => {
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "aligntrue.mdc"), "# Test Rule\n", "utf-8");

      const customBranch = "feature/custom-rules-sync";

      const result = await gitIntegration.apply({
        mode: "branch",
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc"],
        branchName: customBranch,
      });

      expect(result.branchCreated).toBe(customBranch);
    }, 20000);

    it("throws error for non-git workspace", async () => {
      const nonGitDir = join(TEST_DIR, "non-git");
      mkdirSync(nonGitDir, { recursive: true });

      await expect(
        gitIntegration.apply({
          mode: "branch",
          workspaceRoot: nonGitDir,
          generatedFiles: ["AGENTS.md"],
        }),
      ).rejects.toThrow(/git repository/);
    });

    it("reuses existing sync branch instead of creating a new one", async () => {
      // Create files to stage
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "aligntrue.mdc"), "# Test Rule\n", "utf-8");

      // First sync - creates a branch
      const result1 = await gitIntegration.apply({
        mode: "branch",
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc"],
      });

      expect(result1.branchCreated).toBeDefined();
      expect(result1.action).toBe("created branch and staged files");
      const firstBranch = result1.branchCreated;

      // Update the file
      writeFileSync(
        join(cursorDir, "aligntrue.mdc"),
        "# Updated Rule\n",
        "utf-8",
      );

      // Second sync - should reuse the existing branch
      const result2 = await gitIntegration.apply({
        mode: "branch",
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc"],
      });

      // Should not create a new branch
      expect(result2.branchCreated).toBeUndefined();
      expect(result2.action).toBe("staged files on existing branch");

      // Should still be on the first branch
      const currentBranch = execSync("git branch --show-current", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();
      expect(currentBranch).toBe(firstBranch);
    }, 20000);

    it("creates an initial commit when repository has none", async () => {
      // Create a fresh directory with git init but no commits
      const freshGitDir = join(TEST_DIR, "fresh-git");
      mkdirSync(freshGitDir, { recursive: true });
      execSync("git init", { cwd: freshGitDir, stdio: "pipe" });
      execSync('git config user.email "test@example.com"', {
        cwd: freshGitDir,
        stdio: "pipe",
      });
      execSync('git config user.name "Test User"', {
        cwd: freshGitDir,
        stdio: "pipe",
      });

      writeFileSync(join(freshGitDir, "AGENTS.md"), "# Agents\n", "utf-8");

      const result = await gitIntegration.apply({
        mode: "branch",
        workspaceRoot: freshGitDir,
        generatedFiles: ["AGENTS.md"],
      });

      expect(result.action).toBe("created branch and staged files");
      expect(result.branchCreated).toMatch(/^aligntrue\/sync-/);

      const log = execSync("git log --oneline", {
        cwd: freshGitDir,
        encoding: "utf-8",
      })
        .trim()
        .split("\n")
        .filter(Boolean);
      expect(log.length).toBeGreaterThan(0);
      expect(log.some((line) => line.includes("Initial commit"))).toBe(true);

      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: freshGitDir,
        encoding: "utf-8",
      }).trim();
      expect(stagedFiles).toContain("AGENTS.md");
    });
  });

  describe("per-exporter overrides", () => {
    beforeEach(() => {
      // Initialize git repo for per-exporter override tests (needed for commit mode)
      execSync("git init", { cwd: TEST_DIR, stdio: "pipe" });
      execSync('git config user.email "test@example.com"', {
        cwd: TEST_DIR,
        stdio: "pipe",
      });
      execSync('git config user.name "Test User"', {
        cwd: TEST_DIR,
        stdio: "pipe",
      });
    });

    it("applies different modes per exporter", async () => {
      // Create files
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "aligntrue.mdc"), "# Cursor\n", "utf-8");
      writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Agents\n", "utf-8");

      const _result = await gitIntegration.apply({
        mode: "ignore", // default
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/aligntrue.mdc", "AGENTS.md"],
        perExporterOverrides: {
          agents: "commit", // AGENTS.md should be committed
        },
      });

      // Cursor files should be in .gitignore
      const gitignorePath = join(TEST_DIR, ".gitignore");
      expect(existsSync(gitignorePath)).toBe(true);

      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
      // AGENTS.md should NOT be in .gitignore (commit mode)
      expect(content).not.toContain("AGENTS.md");

      // AGENTS.md should be staged
      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();
      expect(stagedFiles).toContain("AGENTS.md");
    });

    it("infers exporter from file path", async () => {
      // Create files
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      const vscodeDir = join(TEST_DIR, ".vscode");
      const amazonqDir = join(TEST_DIR, ".amazonq", "rules");
      const windsurfDir = join(TEST_DIR, ".windsurf");
      mkdirSync(cursorDir, { recursive: true });
      mkdirSync(vscodeDir, { recursive: true });
      mkdirSync(amazonqDir, { recursive: true });
      mkdirSync(windsurfDir, { recursive: true });
      writeFileSync(join(cursorDir, "global.mdc"), "# Cursor\n", "utf-8");
      writeFileSync(join(vscodeDir, "mcp.json"), "{}\n", "utf-8");
      writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Agents\n", "utf-8");
      writeFileSync(join(amazonqDir, "test.md"), "# Amazon Q\n", "utf-8");
      writeFileSync(join(windsurfDir, "mcp_config.json"), "{}\n", "utf-8");

      const files = [
        ".cursor/rules/global.mdc",
        ".vscode/mcp.json",
        "AGENTS.md",
        ".amazonq/rules/test.md",
        ".windsurf/mcp_config.json",
      ];

      const _result = await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
        perExporterOverrides: {
          cursor: "commit",
          "vscode-mcp": "commit",
        },
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, "utf-8");

        // Cursor and VS Code should NOT be in .gitignore (commit mode)
        expect(content).not.toContain(".cursor/");
        expect(content).not.toContain(".vscode/");

        // Others should be in .gitignore (default ignore mode)
        expect(content).toContain("AGENTS.md");
        expect(content).toContain(".amazonq/");
        expect(content).toContain(".windsurf/");
      }

      // Cursor and VS Code files should be staged
      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();
      expect(stagedFiles).toContain(".cursor/rules/global.mdc");
      expect(stagedFiles).toContain(".vscode/mcp.json");
    });

    it("applies branch mode per-exporter while others use ignore mode", async () => {
      // Need initial commit for branch mode
      const readmePath = join(TEST_DIR, "README.md");
      writeFileSync(readmePath, "# Test Repo\n", "utf-8");
      execSync("git add README.md", { cwd: TEST_DIR, stdio: "pipe" });
      execSync('git commit -m "Initial commit"', {
        cwd: TEST_DIR,
        stdio: "pipe",
      });

      // Create files
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "global.mdc"), "# Cursor\n", "utf-8");
      writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Agents\n", "utf-8");

      const result = await gitIntegration.apply({
        mode: "ignore", // default for most exporters
        workspaceRoot: TEST_DIR,
        generatedFiles: [".cursor/rules/global.mdc", "AGENTS.md"],
        perExporterOverrides: {
          cursor: "branch", // cursor files go to branch
        },
      });

      // Should return branch mode result (or ignore, depending on order)
      expect(["ignore", "branch"]).toContain(result.mode);

      // AGENTS.md should be in .gitignore (default ignore mode)
      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("AGENTS.md");

      // Cursor should NOT be in .gitignore (branch mode)
      expect(content).not.toContain(".cursor/");

      // A branch should have been created for cursor files
      const branches = execSync("git branch", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });
      expect(branches).toMatch(/aligntrue\/sync-/);
    }, 20000);
  });

  describe("edge cases", () => {
    it("handles empty file list", async () => {
      const result = await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: [],
      });

      expect(result.action).toBe("no files to process");
      expect(result.filesAffected).toEqual([]);
    });

    it("handles files with special characters", async () => {
      const files = [".cursor/rules/special-chars-🎉.mdc"];

      const _result = await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("special-chars-🎉.mdc");
    });

    it("handles deeply nested paths", async () => {
      const files = ["a/b/c/d/e/f/deep.mdc"];

      const _result = await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: files,
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");
      expect(content).toContain("a/b/c/d/e/f/deep.mdc");
    });

    it("normalizes absolute paths to relative paths", async () => {
      const absolutePaths = [
        join(TEST_DIR, ".cursor/rules/aligntrue.mdc"),
        join(TEST_DIR, "AGENTS.md"),
      ];

      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: absolutePaths,
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");

      // Should contain relative paths, not absolute
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
      expect(content).toContain("AGENTS.md");
      // Should NOT contain absolute paths
      expect(content).not.toContain(TEST_DIR);
    });

    it("normalizes windows-style backslashes to forward slashes", async () => {
      // Simulate windows paths (which exporters might return)
      const windowsPaths = [".cursor\\rules\\aligntrue.mdc", "AGENTS.md"];

      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: windowsPaths,
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");

      // Should normalize to forward slashes
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
      expect(content).not.toContain("\\");
    });

    it("handles mixed absolute and relative paths", async () => {
      const mixedPaths = [
        join(TEST_DIR, ".cursor/rules/aligntrue.mdc"), // absolute
        "AGENTS.md", // relative
        join(TEST_DIR, "apps/docs/.cursor/rules/web.mdc"), // absolute nested
      ];

      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: mixedPaths,
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");

      // All should be normalized to relative paths
      expect(content).toContain(".cursor/rules/aligntrue.mdc");
      expect(content).toContain("AGENTS.md");
      expect(content).toContain("apps/docs/.cursor/rules/web.mdc");
      // Should NOT contain absolute paths
      expect(content).not.toContain(TEST_DIR);
    });

    it("does not incorrectly match paths that share prefix but are outside workspace", async () => {
      // Simulate a path that shares a prefix with workspace but is in a different tree
      // e.g., workspace is /tmp/test-xxx and path is /tmp/test-xxxOTHER/file.mdc
      const outsidePath = TEST_DIR + "OTHER/.cursor/rules/file.mdc";

      await gitIntegration.apply({
        mode: "ignore",
        workspaceRoot: TEST_DIR,
        generatedFiles: [outsidePath],
      });

      const gitignorePath = join(TEST_DIR, ".gitignore");
      const content = readFileSync(gitignorePath, "utf-8");

      // Should NOT convert to relative path starting with ../
      // Should keep the original path as-is (normalized slashes)
      expect(content).not.toContain("../");
      expect(content).toContain(outsidePath.replace(/\\/g, "/"));
    });
  });
});
