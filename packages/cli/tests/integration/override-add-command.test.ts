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
const DEFAULT_CONFIG = { exporters: ["cursor"] };

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
  function configPath(): string {
    return join(TEST_DIR, ".aligntrue", "config.yaml");
  }

  function rulesPath(): string {
    return join(TEST_DIR, ".aligntrue", ".rules.yaml");
  }

  function createBaseIr(): Record<string, unknown> {
    return {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1",
      profile: { version: "1.0.0" },
      sections: [
        createSection("test-rule", "Test Rule 1"),
        createSection("existing", "Existing Rule"),
        createSection("new-rule", "New Rule"),
        createSection("test", "Test Rule"),
      ],
    };
  }

  function createSection(
    fingerprint: string,
    heading: string,
  ): Record<string, unknown> {
    return {
      heading,
      level: 2,
      content: `${heading}\n`,
      fingerprint,
    };
  }

  function writeConfig(config: Record<string, unknown> = DEFAULT_CONFIG): void {
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    writeFileSync(configPath(), yaml.stringify(config), "utf-8");
  }

  function writeIr(customize?: (ir: Record<string, unknown>) => void): void {
    const ir = createBaseIr();
    if (customize) {
      customize(ir);
    }
    writeFileSync(rulesPath(), yaml.stringify(ir), "utf-8");
  }

  function setupWorkspace(
    config: Record<string, unknown> = DEFAULT_CONFIG,
    customizeIr?: (ir: Record<string, unknown>) => void,
  ): void {
    writeConfig(config);
    writeIr(customizeIr);
  }

  describe("Basic Override", () => {
    it("adds override to config with --set operation", async () => {
      setupWorkspace();

      await overrideAdd([
        "--selector",
        "rule[id=test-rule]",
        "--set",
        "severity=warn",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

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
      setupWorkspace();

      await overrideAdd([
        "--selector",
        "rule[id=test-rule]",
        "--set",
        "severity=critical",
        "--set",
        "enabled=false",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

      expect(updatedConfig.overlays.overrides[0].set).toEqual({
        severity: "critical",
        enabled: false,
      });
    });

    it("parses boolean values", async () => {
      setupWorkspace();

      await overrideAdd([
        "--selector",
        "rule[id=test]",
        "--set",
        "enabled=false",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

      expect(updatedConfig.overlays.overrides[0].set.enabled).toBe(false);
    });

    it("parses number values", async () => {
      setupWorkspace();

      await overrideAdd([
        "--selector",
        "rule[id=test]",
        "--set",
        "priority=10",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

      expect(updatedConfig.overlays.overrides[0].set.priority).toBe(10);
    });
  });

  describe("Multiple Overrides", () => {
    it("appends to existing overrides array", async () => {
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
      setupWorkspace(config);

      await overrideAdd([
        "--selector",
        "rule[id=new-rule]",
        "--set",
        "enabled=false",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

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
      setupWorkspace();

      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await overrideAdd(["--selector", "rule[id=test]"]);

      process.exit = originalExit;
      expect(exitCode).toBe(1);
    });

    it("fails when selector does not match IR", async () => {
      setupWorkspace();

      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await overrideAdd([
        "--selector",
        "rule[id=missing-rule]",
        "--set",
        "severity=error",
      ]);

      process.exit = originalExit;
      expect(exitCode).toBe(1);
    });
  });

  describe("Selector Syntax", () => {
    it("supports sections[0] index-based selector syntax", async () => {
      setupWorkspace();

      await overrideAdd([
        "--selector",
        "sections[0]",
        "--set",
        "severity=warn",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

      expect(updatedConfig.overlays).toBeDefined();
      expect(updatedConfig.overlays.overrides).toHaveLength(1);
      expect(updatedConfig.overlays.overrides[0].selector).toBe("sections[0]");
      expect(updatedConfig.overlays.overrides[0].set).toEqual({
        severity: "warn",
      });
    });

    it("supports property path selector syntax", async () => {
      const config = { exporters: ["cursor"], profile: { version: "1.0.0" } };
      setupWorkspace(config);

      await overrideAdd([
        "--selector",
        "profile.version",
        "--set",
        "value=2.0.0",
      ]);

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

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
      setupWorkspace();

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

      const updatedConfig = yaml.parse(readFileSync(configPath(), "utf-8"));

      expect(updatedConfig.overlays.overrides).toHaveLength(2);
      expect(updatedConfig.overlays.overrides[0].selector).toBe("sections[0]");
      expect(updatedConfig.overlays.overrides[1].selector).toBe("sections[1]");
    });
  });
});
