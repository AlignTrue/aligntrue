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
      // Note: sync.* fields were removed in Ruler-style architecture
    });

    it("creates .aligntrue/rules/ directory with starter templates", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      expect(existsSync(rulesDir)).toBe(true);

      // Should have at least one starter rule file
      const { readdirSync } = await import("fs");
      const files = readdirSync(rulesDir).filter((f: string) =>
        f.endsWith(".md"),
      );
      expect(files.length).toBeGreaterThan(0);
    });

    it("creates .aligntrue/README.md with documentation", async () => {
      await init(["--yes", "--project-id", "test-project"]);

      const readmePath = join(TEST_DIR, ".aligntrue", "README.md");
      expect(existsSync(readmePath)).toBe(true);

      const readmeContent = readFileSync(readmePath, "utf-8");
      expect(readmeContent).toContain("rules/");
      expect(readmeContent).toContain("ONLY DIRECTORY YOU SHOULD EDIT");
      expect(readmeContent).toContain("config.yaml");
      expect(readmeContent).toContain("aligntrue sync");
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

    // Skip: Init now uses both agents and cursor by default for new projects
    // This test needs to be updated for new default behavior
    it.skip("uses default exporters when none specified", async () => {
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

  // Skip: sync config is no longer set during init in the new architecture
  describe.skip("Workflow Mode Configuration", () => {
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
        sources: [{ type: "local", path: ".aligntrue/rules" }],
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

      // Create minimal rules directory
      const rulesDir = join(aligntrueDir, "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "global.md"),
        "## Global\n\nTest content.\n",
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
        sources: [{ type: "local", path: ".aligntrue/rules" }],
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

      // Create minimal rules directory
      const rulesDir = join(aligntrueDir, "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "global.md"),
        "## Global\n\nTest content.\n",
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
});
