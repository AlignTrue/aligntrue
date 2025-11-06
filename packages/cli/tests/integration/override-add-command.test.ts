/**
 * Integration tests for override-add command
 * Tests real config updates
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideAdd } from "../../src/commands/override-add.js";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

const TEST_DIR = join(tmpdir(), "aligntrue-test-override-add");

beforeEach(() => {
  cleanupDir(TEST_DIR);
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});

afterEach(() => {
  cleanupDir(TEST_DIR);
});

describe("Override Add Command Integration", () => {
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
});
