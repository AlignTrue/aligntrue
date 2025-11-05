/**
 * Integration tests for team command
 * Tests real lockfile operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { team } from "../../src/commands/team.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-team");

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Team Command Integration", () => {
  describe("Team Init", () => {
    it("converts solo config to team mode", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      await team(["init", "--yes"]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );
      expect(updatedConfig.mode).toBe("team");
    });

    it("creates lockfile when initializing team mode", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      await team(["init", "--yes"]);

      const lockfilePath = join(TEST_DIR, ".aligntrue.lock.json");
      expect(existsSync(lockfilePath)).toBe(true);

      const lockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
      expect(lockfile.lock_schema_version).toBeDefined();
      expect(lockfile.content_hash).toBeDefined();
    });
  });

  describe("Team Approve", () => {
    it("adds source to allow list", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { mode: "team", exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await team(["approve", "github.com/org/repo"]);

      const allowListPath = join(TEST_DIR, ".aligntrue", "allow.yaml");
      expect(existsSync(allowListPath)).toBe(true);

      const allowList = yaml.parse(readFileSync(allowListPath, "utf-8"));
      expect(allowList.approved_sources).toContain("github.com/org/repo");
    });
  });
});
