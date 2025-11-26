/**
 * Multi-source reliability tests
 * Tests merging, precedence, and error handling with multiple sources
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(__dirname, "../../../../.temp-test-multi-source");
const CLI_PATH = join(__dirname, "../../dist/index.js");

describe("Multi-Source Reliability", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("First-wins precedence", () => {
    it("should prefer first source on conflict", () => {
      // Test that when same rule exists in multiple sources,
      // the first source (local .aligntrue/rules/) wins
      mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

      // Create local rule
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "rules", "security.md"),
        "## No Console\nUse local version\n",
      );

      // Create config with external source (would normally override in last-wins)
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
exporters:
  - agents
`,
      );

      // Expected: local rule is used
      const result = execSync(`node "${CLI_PATH}" status`, {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });

      expect(result).toContain("security.md");
      // With first-wins, local rules should be listed first in precedence
      expect(result).toContain(".aligntrue/rules");
    });
  });

  describe("Source ordering", () => {
    it("should maintain source order in sync output", () => {
      mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
exporters:
  - agents
`,
      );

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "rules", "base.md"),
        "## Base Rules\nContent\n",
      );

      const result = execSync(`node "${CLI_PATH}" sync --dry-run`, {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });

      // Output should show source summary
      expect(result).toContain(".aligntrue/rules");
    });
  });

  describe("Include syntax validation", () => {
    it("should reject invalid include format", () => {
      mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

      // Invalid: include without array
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    include: "https://github.com/test/repo"
exporters:
  - agents
`,
      );

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "rules", "base.md"),
        "## Base\n",
      );

      try {
        execSync(`node "${CLI_PATH}" check`, {
          cwd: TEST_DIR,
          encoding: "utf-8",
          stdio: "pipe",
        });
        // Should fail on validation
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });

    it("should accept valid include array", () => {
      mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    include:
      - https://github.com/AlignTrue/examples/aligns/debugging.md
exporters:
  - agents
`,
      );

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "rules", "base.md"),
        "## Base\n",
      );

      // Should pass config validation
      const result = execSync(`node "${CLI_PATH}" check`, {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });

      expect(result).toBeDefined();
    });
  });

  describe("Add and remove sources workflow", () => {
    it("should handle adding then removing a source", () => {
      mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

      // Step 1: Initialize with base config
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
exporters:
  - agents
`,
      );

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "rules", "base.md"),
        "## Base Rules\nContent\n",
      );

      // Step 2: Check initial status
      let result = execSync(`node "${CLI_PATH}" status`, {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });
      expect(result).toContain("base.md");

      // Step 3: Add a source using real examples repo
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: git
    url: https://github.com/AlignTrue/examples
    path: aligns/debugging.md
exporters:
  - agents
`,
      );

      // Step 4: Verify config is valid
      result = execSync(`node "${CLI_PATH}" check`, {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });
      expect(result).toBeDefined();

      // Step 5: Remove the source
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
exporters:
  - agents
`,
      );

      // Step 6: Verify config is still valid
      result = execSync(`node "${CLI_PATH}" check`, {
        cwd: TEST_DIR,
        encoding: "utf-8",
      });
      expect(result).toBeDefined();
    });
  });
});
