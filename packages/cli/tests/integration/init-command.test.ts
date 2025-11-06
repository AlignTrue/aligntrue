/**
 * Integration tests for init command
 * Tests real file system operations without mocking @aligntrue/* packages
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-init");

beforeEach(() => {
  // Create fresh test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });

  // Change to test directory
  process.chdir(TEST_DIR);
});

afterEach(() => {
  // Cleanup
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Init Command Integration", () => {
  describe("Fresh Start", () => {
    it("creates .aligntrue/config.yaml with correct structure", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toBeDefined();
      expect(Array.isArray(config.exporters)).toBe(true);
      expect(config.exporters.length).toBeGreaterThan(0);
      expect(config.sync).toBeDefined();
      expect(config.sync.workflow_mode).toBe("ir_source");
    });

    it("creates .aligntrue/.rules.yaml with starter template", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const rulesPath = join(TEST_DIR, ".aligntrue", ".rules.yaml");
      expect(existsSync(rulesPath)).toBe(true);

      const rulesContent = readFileSync(rulesPath, "utf-8");
      expect(rulesContent).toContain("spec_version:");
      expect(rulesContent).toContain("rules:");
    });

    it("creates .cursor/rules/aligntrue-starter.mdc when cursor is primary exporter", async () => {
      await init([
        "--yes",
        "--project-id",
        "test-project",
        "--exporters",
        "cursor",
      ]);

      const cursorPath = join(
        TEST_DIR,
        ".cursor",
        "rules",
        "aligntrue-starter.mdc",
      );
      expect(existsSync(cursorPath)).toBe(true);

      const cursorContent = readFileSync(cursorPath, "utf-8");
      expect(cursorContent).toContain("---");
      expect(cursorContent).toContain("description:");
      expect(cursorContent).toContain("alwaysApply:");
    });

    it("uses default exporters when none specified", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toContain("cursor");
      expect(config.exporters).toContain("agents-md");
    });

    it("respects --exporters flag", async () => {
      await init([
        "--yes",
        "--project-id",
        "test-project",
        "--exporters",
        "cursor,agents-md",
      ]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toEqual(["cursor", "agents-md"]);
    });

    it("uses provided project-id in rules", async () => {
      await init(["--yes", "--project-id", "my-custom-project"]);

      const rulesPath = join(TEST_DIR, ".aligntrue", ".rules.yaml");
      const rulesContent = readFileSync(rulesPath, "utf-8");

      expect(rulesContent).toContain("my-custom-project");
    });
  });

  describe("Already Initialized", () => {
    it("detects existing .aligntrue directory and exits", async () => {
      // Create existing .aligntrue directory
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        "exporters:\n  - cursor\n",
        "utf-8",
      );

      // Mock process.exit to capture exit code
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await init(["--yes", "--project-id", "test-project"]);

      // Restore process.exit
      process.exit = originalExit;

      expect(exitCode).toBe(0);
    });
  });

  describe("File Creation", () => {
    it("creates all files atomically (no .tmp files left behind)", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      // Check no .tmp files exist
      const files = [
        join(TEST_DIR, ".aligntrue", "config.yaml.tmp"),
        join(TEST_DIR, ".aligntrue", ".rules.yaml.tmp"),
        join(TEST_DIR, ".cursor", "rules", "aligntrue-starter.mdc.tmp"),
      ];

      files.forEach((file) => {
        expect(existsSync(file)).toBe(false);
      });
    });

    it("creates directories recursively as needed", async () => {
      await init([
        "--yes",
        "--project-id",
        "test-project",
        "--exporters",
        "cursor",
      ]);

      expect(existsSync(join(TEST_DIR, ".aligntrue"))).toBe(true);
      expect(existsSync(join(TEST_DIR, ".cursor"))).toBe(true);
      expect(existsSync(join(TEST_DIR, ".cursor", "rules"))).toBe(true);
    });
  });

  describe("Workflow Mode Configuration", () => {
    it("configures ir_source workflow for fresh start", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.sync.workflow_mode).toBe("ir_source");
      expect(config.sync.auto_pull).toBe(false);
    });
  });
});
