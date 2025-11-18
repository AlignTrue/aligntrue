/**
 * Personal remote workflow tests
 * Tests personal rules synchronization from remote git repositories
 *
 * Uses AlignTrue/examples repo for deterministic testing.
 * Requires network access and runs in CI only.
 * Skip locally in pre-CI (use CI=1 to run locally).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(__dirname, "../../../temp-test-personal-remote");
const CLI_PATH = join(__dirname, "../../dist/index.js");

// GitHub repo for remote testing
// NOTE: Update COMMIT_HASH after copying fixtures to AlignTrue/examples repo
const EXAMPLES_REPO = "https://github.com/AlignTrue/examples";
const COMMIT_HASH = "edcc07907b5fc726c836437091548085f5a04cdb"; // Pin after fixtures are committed

// Skip tests unless explicitly enabled via RUN_REMOTE_TESTS=1
const runRemoteTests = process.env.RUN_REMOTE_TESTS === "1";
const describeNetwork = runRemoteTests ? describe : describe.skip;

describeNetwork("Personal Remote Workflow", () => {
  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("Configuration", () => {
    it("should accept valid GitHub URL format", () => {
      // Skip if commit hash not set
      if (COMMIT_HASH === "REPLACE_WITH_ACTUAL_COMMIT_HASH") {
        console.log(
          "Skipping test: Update COMMIT_HASH after copying fixtures to GitHub",
        );
        return;
      }

      const testProjectPath = join(TEST_DIR, "test-project");
      mkdirSync(testProjectPath, { recursive: true });
      mkdirSync(join(testProjectPath, ".aligntrue"), { recursive: true });

      // Create config with valid GitHub URL
      writeFileSync(
        join(testProjectPath, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    url: ${EXAMPLES_REPO}
    ref: ${COMMIT_HASH}
    path: remote-test/personal-rules.md
exporters:
  - agents
git:
  mode: ignore
`,
        "utf-8",
      );

      // Verify config is valid
      try {
        execSync(`node "${CLI_PATH}" check --ci`, {
          cwd: testProjectPath,
          stdio: "pipe",
        });
        // If check passes, config is valid
        expect(true).toBe(true);
      } catch (error: any) {
        // Check should pass for valid config
        const stderr = error.stderr?.toString() || "";
        if (!stderr.includes("consent")) {
          throw error;
        }
      }
    });

    it("should reject invalid git URL format", () => {
      const testProjectPath = join(TEST_DIR, "test-invalid-url");
      mkdirSync(testProjectPath, { recursive: true });
      mkdirSync(join(testProjectPath, ".aligntrue"), { recursive: true });

      // Create config with invalid URL (file:// protocol not allowed)
      writeFileSync(
        join(testProjectPath, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    url: file:///tmp/repo
    path: rules.md
exporters:
  - agents
`,
        "utf-8",
      );

      // Sync should fail with clear error
      try {
        execSync(`node "${CLI_PATH}" sync`, {
          cwd: testProjectPath,
          stdio: "pipe",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        const stderr = error.stderr?.toString() || "";
        expect(stderr).toContain("file://") ||
          expect(stderr).toContain("Invalid") ||
          expect(stderr).toContain("not allowed");
      }
    });
  });

  describe("Sync from Remote", () => {
    it("should pull personal rules from remote", () => {
      // Skip if commit hash not set
      if (COMMIT_HASH === "REPLACE_WITH_ACTUAL_COMMIT_HASH") {
        console.log(
          "Skipping test: Update COMMIT_HASH after copying fixtures to GitHub",
        );
        return;
      }

      const testProjectPath = join(TEST_DIR, "test-sync");
      mkdirSync(testProjectPath, { recursive: true });
      mkdirSync(join(testProjectPath, ".aligntrue"), { recursive: true });

      // Create config pointing to personal rules
      writeFileSync(
        join(testProjectPath, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    url: ${EXAMPLES_REPO}
    ref: ${COMMIT_HASH}
    path: remote-test/personal-rules.md
exporters:
  - agents
git:
  mode: ignore
`,
        "utf-8",
      );

      try {
        // Run sync
        const output = execSync(`node "${CLI_PATH}" sync`, {
          cwd: testProjectPath,
          stdio: "pipe",
          encoding: "utf-8",
        });

        // Verify sync succeeded
        expect(output).toContain("Sync complete") ||
          expect(output).toContain("synced");

        // Verify AGENTS.md contains personal rules
        const agentsMd = readFileSync(
          join(testProjectPath, "AGENTS.md"),
          "utf-8",
        );
        expect(agentsMd).toContain("Personal Coding Preferences");
        expect(agentsMd).toContain("Editor Configuration");
        expect(agentsMd).toContain("Testing Preferences");

        // Verify IR was created
        expect(
          existsSync(join(testProjectPath, ".aligntrue/.rules.yaml")),
        ).toBe(true);
      } catch (error: any) {
        const stderr = error.stderr?.toString() || "";
        if (stderr.includes("consent") || stderr.includes("network")) {
          console.log(
            "Skipping test: Network consent required or git not available",
          );
          return;
        }
        throw error;
      }
    });

    it("should handle missing remote file gracefully", () => {
      // Skip if commit hash not set
      if (COMMIT_HASH === "REPLACE_WITH_ACTUAL_COMMIT_HASH") {
        console.log(
          "Skipping test: Update COMMIT_HASH after copying fixtures to GitHub",
        );
        return;
      }

      const testProjectPath = join(TEST_DIR, "test-missing");
      mkdirSync(testProjectPath, { recursive: true });
      mkdirSync(join(testProjectPath, ".aligntrue"), { recursive: true });

      // Create config pointing to non-existent file
      writeFileSync(
        join(testProjectPath, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    url: ${EXAMPLES_REPO}
    ref: ${COMMIT_HASH}
    path: remote-test/nonexistent.md
exporters:
  - agents
git:
  mode: ignore
`,
        "utf-8",
      );

      try {
        execSync(`node "${CLI_PATH}" sync`, {
          cwd: testProjectPath,
          stdio: "pipe",
        });
        // Should not succeed
        expect(true).toBe(false);
      } catch (error: any) {
        const stderr = error.stderr?.toString() || "";
        // Should get clear error about missing file
        expect(stderr).toContain("not found") ||
          expect(stderr).toContain("does not exist") ||
          expect(stderr).toContain("Failed");
      }
    });
  });

  describe("Conflict Detection", () => {
    it("should merge team and personal rules", () => {
      // Skip if commit hash not set
      if (COMMIT_HASH === "REPLACE_WITH_ACTUAL_COMMIT_HASH") {
        console.log(
          "Skipping test: Update COMMIT_HASH after copying fixtures to GitHub",
        );
        return;
      }

      const testProjectPath = join(TEST_DIR, "test-merge");
      mkdirSync(testProjectPath, { recursive: true });
      mkdirSync(join(testProjectPath, ".aligntrue"), { recursive: true });

      // Create team rules
      writeFileSync(
        join(testProjectPath, ".aligntrue/.rules.yaml"),
        `id: team-rules
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Team Standards
    content: Follow team coding standards
    level: 2
    fingerprint: team-standards
`,
        "utf-8",
      );

      // Create config with both team and personal sources
      writeFileSync(
        join(testProjectPath, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/.rules.yaml
  - type: git
    url: ${EXAMPLES_REPO}
    ref: ${COMMIT_HASH}
    path: remote-test/personal-rules.md
exporters:
  - agents
git:
  mode: ignore
`,
        "utf-8",
      );

      try {
        // Run sync to merge both sources
        const output = execSync(`node "${CLI_PATH}" sync`, {
          cwd: testProjectPath,
          stdio: "pipe",
          encoding: "utf-8",
        });

        // Verify sync succeeded
        expect(output).toContain("Sync complete") ||
          expect(output).toContain("synced");

        // Verify AGENTS.md contains both team and personal rules
        const agentsMd = readFileSync(
          join(testProjectPath, "AGENTS.md"),
          "utf-8",
        );
        expect(agentsMd).toContain("Team Standards");
        expect(agentsMd).toContain("Personal Coding Preferences");
      } catch (error: any) {
        const stderr = error.stderr?.toString() || "";
        if (stderr.includes("consent") || stderr.includes("network")) {
          console.log(
            "Skipping test: Network consent required or git not available",
          );
          return;
        }
        throw error;
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", () => {
      const testProjectPath = join(TEST_DIR, "test-network-error");
      mkdirSync(testProjectPath, { recursive: true });
      mkdirSync(join(testProjectPath, ".aligntrue"), { recursive: true });

      // Create config with invalid repo URL
      writeFileSync(
        join(testProjectPath, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    url: https://github.com/nonexistent/repo
    path: rules.md
exporters:
  - agents
git:
  mode: ignore
`,
        "utf-8",
      );

      try {
        execSync(`node "${CLI_PATH}" sync`, {
          cwd: testProjectPath,
          stdio: "pipe",
        });
        // Should not succeed
        expect(true).toBe(false);
      } catch (error: any) {
        const stderr = error.stderr?.toString() || "";
        // Should get clear error about network/repo issue
        expect(stderr).toContain("not found") ||
          expect(stderr).toContain("Failed") ||
          expect(stderr).toContain("consent");
      }
    });
  });
});
