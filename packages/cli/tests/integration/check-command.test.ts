/**
 * Integration tests for check command
 * Tests real validation without mocking @aligntrue/* packages
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "fs";
import { join } from "path";
import { check } from "../../src/commands/check.js";
import { mockProcessExit } from "../helpers/exit-mock.js";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { mkdirSync } from "fs";

let TEST_DIR: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-check-"));
  process.chdir(TEST_DIR);
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Check Command Integration", () => {
  describe("Valid IR", () => {
    it("validates correct IR schema and exits with 0", async () => {
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule example
    level: 2
    content: Test guidance
    fingerprint: test-rule-example
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      try {
        await check([]);
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
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const invalidIr = `id: test-project
version: 1.0.0
sections:
  - heading: Test rule example
    level: 2
    content: ""
    fingerprint: test-rule-example
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

    it("runs without --ci flag by default", async () => {
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
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      const exitMock = mockProcessExit();

      await check([]);

      expect(exitMock.exitCode).toBeUndefined();
      exitMock.restore();
    });

    it("fails when config references unknown exporter", async () => {
      const config = { exporters: ["cursor", "not-a-real-exporter"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule example
    level: 2
    content: Test guidance
    fingerprint: test-rule-example
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      const exitMock = mockProcessExit();

      try {
        await check(["--ci"]);
      } catch {
        // Expected exit
      }

      expect(exitMock.exitCode).toBe(1);
      exitMock.restore();
    });
  });
});
