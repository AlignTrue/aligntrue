/**
 * Integration tests for override-add command
 * Tests real config updates
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideAdd } from "../../src/commands/override-add.js";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

let TEST_DIR: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-override-add-"));
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Override Add Command Integration", () => {
  describe("Basic Override", () => {
    it("adds override to config with --set operation", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "rule[id=test-rule]",
        "--set",
        "severity=warn",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays).toBeDefined();
      expect(updatedConfig.overlays.overrides).toHaveLength(1);
      expect(updatedConfig.overlays.overrides[0].selector).toBe(
        "rule[id=test-rule]",
      );
      expect(updatedConfig.overlays.overrides[0].set).toEqual({
        severity: "warn",
      });
    });

    it("adds override with multiple --set operations", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "rule[id=test-rule]",
        "--set",
        "severity=critical",
        "--set",
        "enabled=false",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides[0].set).toEqual({
        severity: "critical",
        enabled: false,
      });
    });

    it("parses boolean values", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "rule[id=test]",
        "--set",
        "enabled=false",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides[0].set.enabled).toBe(false);
    });

    it("parses number values", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "rule[id=test]",
        "--set",
        "priority=10",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides[0].set.priority).toBe(10);
    });
  });

  describe("Multiple Overrides", () => {
    it("appends to existing overrides array", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
        overlays: {
          overrides: [
            {
              selector: "rule[id=existing]",
              set: { severity: "warn" },
            },
          ],
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "rule[id=new-rule]",
        "--set",
        "enabled=false",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides).toHaveLength(2);
      expect(updatedConfig.overlays.overrides[0].selector).toBe(
        "rule[id=existing]",
      );
      expect(updatedConfig.overlays.overrides[1].selector).toBe(
        "rule[id=new-rule]",
      );
    });
  });

  describe("Error Handling", () => {
    it("exits with error if no operations provided", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await overrideAdd(["--selector", "rule[id=test]"]);

      process.exit = originalExit;
      expect(exitCode).toBe(1);
    });
  });

  describe("Selector Syntax", () => {
    it("supports sections[0] index-based selector syntax", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "sections[0]",
        "--set",
        "severity=warn",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays).toBeDefined();
      expect(updatedConfig.overlays.overrides).toHaveLength(1);
      expect(updatedConfig.overlays.overrides[0].selector).toBe("sections[0]");
      expect(updatedConfig.overlays.overrides[0].set).toEqual({
        severity: "warn",
      });
    });

    it("supports property path selector syntax", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"], profile: { version: "1.0.0" } };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      await overrideAdd([
        "--selector",
        "profile.version",
        "--set",
        "value=2.0.0",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays).toBeDefined();
      expect(updatedConfig.overlays.overrides).toHaveLength(1);
      expect(updatedConfig.overlays.overrides[0].selector).toBe(
        "profile.version",
      );
      expect(updatedConfig.overlays.overrides[0].set).toEqual({
        value: "2.0.0",
      });
    });

    it("supports multiple section index selectors", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Add first override
      await overrideAdd([
        "--selector",
        "sections[0]",
        "--set",
        "severity=error",
      ]);

      // Add second override
      await overrideAdd([
        "--selector",
        "sections[1]",
        "--set",
        "severity=warn",
      ]);

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides).toHaveLength(2);
      expect(updatedConfig.overlays.overrides[0].selector).toBe("sections[0]");
      expect(updatedConfig.overlays.overrides[1].selector).toBe("sections[1]");
    });
  });
});
