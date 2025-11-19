/**
 * Integration tests for init command
 * Tests real file system operations without mocking @aligntrue/* packages
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

let TEST_DIR: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-init-"));
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Init Command Integration", () => {
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
      expect(config.sync.workflow_mode).toBeUndefined();
    });

    it("creates .aligntrue/.rules.yaml with starter template", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const rulesPath = join(TEST_DIR, ".aligntrue", ".rules.yaml");
      expect(existsSync(rulesPath)).toBe(true);

      const rulesContent = readFileSync(rulesPath, "utf-8");
      expect(rulesContent).toContain("spec_version");
      expect(rulesContent).toContain("sections");
    });

    it("does not create cursor starter files automatically", async () => {
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
      expect(existsSync(cursorPath)).toBe(false);
    });

    it("uses default exporters when none specified", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toEqual(["agents"]);
    });

    it("respects --exporters flag", async () => {
      await init([
        "--yes",
        "--project-id",
        "test-project",
        "--exporters",
        "cursor,agents",
      ]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toEqual(["cursor", "agents"]);
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
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
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
    });
  });

  describe("Workflow Mode Configuration", () => {
    it("configures ir_source workflow for fresh start", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      // sync settings are not set during init (handled by workflow detection later)
      expect(config.sync).toBeDefined();
    });
  });

  describe("Team Mode Detection", () => {
    it("detects team mode from existing lockfile", async () => {
      // Setup: Create a team configuration with lockfile
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Create a team mode config
      const teamConfig = {
        mode: "team",
        sources: [{ type: "local", path: ".aligntrue/.rules.yaml" }],
        exporters: ["cursor", "agents"],
        modules: { lockfile: true, bundle: true },
      };
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
        yaml.stringify(teamConfig),
        "utf-8",
      );

      // Create a lockfile (indicates team mode)
      const lockfile = {
        bundle_hash: "test-hash",
        generated_at: new Date().toISOString(),
        mode: "team",
        rules: [],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue.lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );

      // Create minimal IR
      const ir = {
        id: "test-project",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };
      writeFileSync(
        join(aligntrueDir, ".rules.yaml"),
        yaml.stringify(ir),
        "utf-8",
      );

      // Mock process.exit to capture exit code and stop execution
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`EXIT_${code}`);
      }) as never;

      // Run init - should detect team mode and exit
      try {
        await init(["--yes"]);
      } catch (err) {
        // Expected - process.exit throws to stop execution
        if (!(err instanceof Error) || !err.message.startsWith("EXIT_")) {
          throw err;
        }
      }

      // Restore process.exit
      process.exit = originalExit;

      // Verify exit code is 0 (success, already initialized)
      expect(exitCode).toBe(0);

      // Verify team mode is preserved
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.mode).toBe("team");
      expect(existsSync(join(TEST_DIR, ".aligntrue.lock.json"))).toBe(true);
    });

    it("detects team mode from lockfile even if config is missing mode field", async () => {
      // Setup: Create config without mode field but with lockfile present
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Create a config without explicit mode
      const config = {
        sources: [{ type: "local", path: ".aligntrue/.rules.yaml" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a lockfile (indicates team mode)
      const lockfile = {
        bundle_hash: "test-hash",
        generated_at: new Date().toISOString(),
        mode: "team",
        rules: [],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue.lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );

      // Create minimal IR
      const ir = {
        id: "test-project",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };
      writeFileSync(
        join(aligntrueDir, ".rules.yaml"),
        yaml.stringify(ir),
        "utf-8",
      );

      // Mock process.exit to capture exit code and stop execution
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`EXIT_${code}`);
      }) as never;

      // Run init - should detect team mode from lockfile and exit
      try {
        await init(["--yes"]);
      } catch (err) {
        // Expected - process.exit throws to stop execution
        if (!(err instanceof Error) || !err.message.startsWith("EXIT_")) {
          throw err;
        }
      }

      // Restore process.exit
      process.exit = originalExit;

      // Verify exit code is 0 (success, already initialized)
      expect(exitCode).toBe(0);

      // Verify lockfile still exists (not deleted)
      expect(existsSync(join(TEST_DIR, ".aligntrue.lock.json"))).toBe(true);
    });

    it("treats standalone lockfile as already initialized", async () => {
      // Remove .aligntrue directory to simulate clone missing config files
      rmSync(join(TEST_DIR, ".aligntrue"), { recursive: true, force: true });

      writeFileSync(
        join(TEST_DIR, ".aligntrue.lock.json"),
        JSON.stringify(
          {
            bundle_hash: "standalone-hash",
            generated_at: new Date().toISOString(),
            mode: "team",
            rules: [],
          },
          null,
          2,
        ),
        "utf-8",
      );

      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`EXIT_${code}`);
      }) as never;

      try {
        await init(["--yes"]);
      } catch (err) {
        if (!(err instanceof Error) || !err.message.startsWith("EXIT_")) {
          throw err;
        }
      } finally {
        process.exit = originalExit;
      }

      expect(exitCode).toBe(0);
    });
  });

  describe("Importing existing agent files", () => {
    it("imports AGENTS.md without overwriting content", async () => {
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      writeFileSync(
        agentsPath,
        "## Existing Rules\n\nAlways run tests before commit.\n",
        "utf-8",
      );

      await init(["--yes", "--project-id", "test-project"]);

      const finalAgentsContent = readFileSync(agentsPath, "utf-8");
      expect(finalAgentsContent).toContain("Existing Rules");

      const rulesContent = readFileSync(
        join(TEST_DIR, ".aligntrue", ".rules.yaml"),
        "utf-8",
      );
      expect(rulesContent).toContain("Existing Rules");
    });

    it("imports cursor .mdc files when present", async () => {
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      const cursorFile = join(cursorDir, "custom.mdc");
      writeFileSync(
        cursorFile,
        `---
title: Custom
alwaysApply: true
---

## Cursor Rule

Be nice to cursors.
`,
        "utf-8",
      );

      await init(["--yes", "--project-id", "test-project"]);

      const rulesContent = readFileSync(
        join(TEST_DIR, ".aligntrue", ".rules.yaml"),
        "utf-8",
      );
      expect(rulesContent).toContain("Cursor Rule");

      // Ensure original file left untouched
      const cursorContent = readFileSync(cursorFile, "utf-8");
      expect(cursorContent).toContain("Cursor Rule");
    });
  });
});
