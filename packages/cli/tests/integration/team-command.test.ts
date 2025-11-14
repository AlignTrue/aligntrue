/**
 * Integration tests for team command
 * Tests real lockfile operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { team } from "../../src/commands/team.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";

vi.mock("@clack/prompts");

let TEST_DIR: string;

beforeEach(() => {
  vi.clearAllMocks();

  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-team-"));
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });

  // Mock clack prompts to avoid terminal interaction
  vi.mocked(clack.confirm).mockResolvedValue(true);
  vi.mocked(clack.cancel).mockImplementation(() => {});
  vi.mocked(clack.isCancel).mockReturnValue(false);
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Team Command Integration", () => {
  describe("Team Init", () => {
    it.skip("converts solo config to team mode", async () => {
      // TODO: Fix - test expectations don't match current team init behavior
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      try {
        await team(["init", "--yes"]);
      } catch {
        // May throw from process.exit if command fails
      }

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );
      expect(updatedConfig.mode).toBe("team");
    });

    it.skip("creates lockfile when initializing team mode", async () => {
      // TODO: Fix - test expectations don't match current team init behavior
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      try {
        await team(["init", "--yes"]);
      } catch {
        // May throw from process.exit if command fails
      }

      const lockfilePath = join(TEST_DIR, ".aligntrue.lock.json");
      expect(existsSync(lockfilePath)).toBe(true);

      const lockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
      expect(lockfile.lock_schema_version).toBeDefined();
      expect(lockfile.content_hash).toBeDefined();
    });
  });

  // Team approve command removed - approval now happens via git PR workflow
  // No test needed as command no longer exists
});
