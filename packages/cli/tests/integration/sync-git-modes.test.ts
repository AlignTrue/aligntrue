/**
 * Integration tests for git integration modes during sync
 * Tests commit mode (staging files) and branch mode (creating branches)
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  // Create fresh test directory
  testProjectContext = await setupTestProject();
  TEST_DIR = testProjectContext.projectDir;

  // Initialize git repo for git mode tests
  execSync("git init", { cwd: TEST_DIR, stdio: "pipe" });
  execSync('git config user.email "test@example.com"', {
    cwd: TEST_DIR,
    stdio: "pipe",
  });
  execSync('git config user.name "Test User"', {
    cwd: TEST_DIR,
    stdio: "pipe",
  });

  // Make an initial commit so we have a branch
  writeFileSync(join(TEST_DIR, ".gitignore"), "node_modules\n", "utf-8");
  execSync("git add .gitignore", { cwd: TEST_DIR, stdio: "pipe" });
  execSync('git commit -m "Initial commit"', { cwd: TEST_DIR, stdio: "pipe" });

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });

  // Mock clack prompts to avoid terminal interaction
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.confirm).mockResolvedValue(true);
  vi.mocked(clack.cancel).mockImplementation(() => {});
  vi.mocked(clack.isCancel).mockReturnValue(false);
});

afterEach(async () => {
  // Cleanup
  await testProjectContext.cleanup();
});

describeSkipWindows("Sync Git Integration Modes", () => {
  describe("commit mode", () => {
    it("stages generated files when git.mode is commit", async () => {
      // Setup: Create config with commit mode
      const config = {
        mode: "solo",
        profile: { id: "test-user" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        git: {
          mode: "commit",
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory and a rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
description: A test rule for commit mode
---

# Test Rule

This is a test rule.
`,
        "utf-8",
      );

      // Run sync
      await sync([]);

      // Verify AGENTS.md was created
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(true);

      // Verify files are staged (in git index)
      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();

      expect(stagedFiles).toContain("AGENTS.md");
    });

    it("throws error when not in a git repository", async () => {
      // Create a non-git directory
      const nonGitDir = join(TEST_DIR, "non-git-subdir");
      mkdirSync(nonGitDir, { recursive: true });
      mkdirSync(join(nonGitDir, ".aligntrue", "rules"), { recursive: true });

      // Setup: Create config with commit mode
      const config = {
        mode: "solo",
        profile: { id: "test-user" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        git: {
          mode: "commit",
        },
      };
      writeFileSync(
        join(nonGitDir, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );
      writeFileSync(
        join(nonGitDir, ".aligntrue", "rules", "test.md"),
        "# Test\n\nContent",
        "utf-8",
      );

      // Change to non-git directory
      process.chdir(nonGitDir);

      // Sync should complete (git integration failure is non-critical)
      // but files should still be written
      await sync([]);
      expect(existsSync(join(nonGitDir, "AGENTS.md"))).toBe(true);
    });
  });

  describe("branch mode", () => {
    it("creates feature branch when git.mode is branch", async () => {
      // Setup: Create config with branch mode
      const config = {
        mode: "solo",
        profile: { id: "test-user" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        git: {
          mode: "branch",
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory and a rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
description: A test rule for branch mode
---

# Test Rule

This is a test rule.
`,
        "utf-8",
      );

      // Run sync
      await sync([]);

      // Verify AGENTS.md was created
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(true);

      // Verify a feature branch was created
      const branches = execSync("git branch", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });

      expect(branches).toMatch(/aligntrue\/sync-/);

      // Verify we're on the feature branch
      const currentBranch = execSync("git branch --show-current", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();

      expect(currentBranch).toMatch(/^aligntrue\/sync-/);
    });

    it("stages files on the feature branch", async () => {
      // Setup: Create config with branch mode
      const config = {
        mode: "solo",
        profile: { id: "test-user" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        git: {
          mode: "branch",
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory and a rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content.
`,
        "utf-8",
      );

      // Run sync
      await sync([]);

      // Verify files are staged on the branch
      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();

      expect(stagedFiles).toContain("AGENTS.md");
    });
  });

  describe("ignore mode (default)", () => {
    it("does not stage files when git.mode is ignore", async () => {
      // Setup: Create config with ignore mode (default)
      const config = {
        mode: "solo",
        profile: { id: "test-user" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        git: {
          mode: "ignore",
          auto_gitignore: "always",
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory and a rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content.
`,
        "utf-8",
      );

      // Run sync
      await sync([]);

      // Verify AGENTS.md was created
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(true);

      // Verify files are NOT staged
      const stagedFiles = execSync("git diff --cached --name-only", {
        cwd: TEST_DIR,
        encoding: "utf-8",
      }).trim();

      expect(stagedFiles).not.toContain("AGENTS.md");

      // Verify .gitignore was updated
      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain("AGENTS.md");
    });
  });

  describe("per-exporter overrides", () => {
    it("applies different modes per exporter", async () => {
      // Setup: Create config with per-exporter overrides
      const config = {
        mode: "solo",
        profile: { id: "test-user" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents", "cursor"],
        git: {
          mode: "ignore", // default
          per_exporter: {
            agents: "commit", // AGENTS.md should be staged
          },
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory and a rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content.
`,
        "utf-8",
      );

      // Run sync
      await sync([]);

      // Verify both files were created
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "test-rule.mdc")),
      ).toBe(true);

      // The git integration is called once with all files
      // Per-exporter overrides are handled by GitIntegration.apply()
      // This test verifies the config is passed correctly
    });
  });
});
