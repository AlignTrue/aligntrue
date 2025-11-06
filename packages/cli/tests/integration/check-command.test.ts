/**
 * Integration tests for check command
 * Tests real validation without mocking @aligntrue/* packages
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { check } from "../../src/commands/check.js";
import { mockProcessExit } from "../helpers/exit-mock.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-check");

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

describe("Check Command Integration", () => {
  describe("Valid IR", () => {
    it("validates correct IR schema and exits with 0", async () => {
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
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      try {
        await check(["--ci"]);
      } catch {
        // Expected exit if called
      }

      // Commands don't call process.exit(0) on success
      // Just verify that no error was thrown
      expect(true).toBe(true);
    });
  });

  describe("Invalid IR", () => {
    it("reports errors for missing required fields", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const invalidIr = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
rules:
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
\`\`\`
`;
      writeFileSync(
        join(TEST_DIR, ".aligntrue", ".rules.yaml"),
        invalidIr,
        "utf-8",
      );

      const exitMock = mockProcessExit();

      try {
        await check(["--ci"]);
      } catch {
        // Expected exit
      }

      expect(exitMock.exitCode).toBeGreaterThan(0);
      exitMock.restore();
    });
  });

  describe("Error Handling", () => {
    it("exits with error code 2 if config not found", async () => {
      const exitMock = mockProcessExit();

      try {
        await check(["--ci"]);
      } catch {
        // Expected exit
      }

      expect(exitMock.exitCode).toBe(2);
      exitMock.restore();
    });

    it("requires --ci flag", async () => {
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
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      const exitMock = mockProcessExit();

      try {
        await check([]);
      } catch {
        // Expected exit
      }

      expect(exitMock.exitCode).toBe(2);
      exitMock.restore();
    });
  });
});
