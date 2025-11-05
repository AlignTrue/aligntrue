/**
 * Integration tests for update command with safe mode (Phase 3.5, Session 4)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { update } from "../../src/commands/update.js";
import {
  existsSync,
  writeFileSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { join } from "path";

const TEST_DIR = ".aligntrue-test-update-safe";
const _CONFIG_PATH = join(TEST_DIR, ".aligntrue", "config.yaml");
const _LOCKFILE_PATH = join(TEST_DIR, ".aligntrue.lock.json");
const _ALLOW_LIST_PATH = join(TEST_DIR, ".aligntrue", "allow.yaml");

describe("update command --safe flag", () => {
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test directory structure in original cwd
    const testDirPath = join(originalCwd, TEST_DIR);
    if (existsSync(testDirPath)) {
      cleanupTestDir(testDirPath);
    }
    mkdirSync(join(testDirPath, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    // Ensure we're back in original directory
    try {
      process.chdir(originalCwd);
    } catch {
      // Directory may not exist, that's ok
    }

    // Cleanup
    const testDirPath = join(originalCwd, TEST_DIR);
    if (existsSync(testDirPath)) {
      try {
        cleanupTestDir(testDirPath);
      } catch {
        // May fail, that's ok
      }
    }
  });

  it("handles --safe flag with no overlays configured", async () => {
    const testDirPath = join(originalCwd, TEST_DIR);
    const configPath = join(testDirPath, ".aligntrue", "config.yaml");
    const lockfilePath = join(testDirPath, ".aligntrue.lock.json");
    const allowListPath = join(testDirPath, ".aligntrue", "allow.yaml");

    // Create minimal config (team mode, no overlays)
    writeFileSync(
      configPath,
      `mode: team
spec_version: "1"
`,
    );

    // Create empty lockfile
    writeFileSync(
      lockfilePath,
      JSON.stringify({
        version: "1",
        generated_at: new Date().toISOString(),
        mode: "team",
        rules: [],
        bundle_hash: "test-hash",
      }),
    );

    // Create empty allow list
    writeFileSync(
      allowListPath,
      `sources: []
`,
    );

    // Change to test directory
    process.chdir(testDirPath);

    // Run update with --safe flag
    let exitCode = 0;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error("EXIT");
    }) as never;

    try {
      await update(["apply", "--safe", "--config", ".aligntrue/config.yaml"]);
    } catch {
      // Expected to exit
    }

    process.exit = originalExit;

    // Should complete without errors (no updates available)
    expect(exitCode).toBe(0);
  });

  it("shows help for --safe and --auto-resolve flags", async () => {
    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
      originalLog(...args);
    };

    try {
      await update(["--help"]);
    } catch {
      // May error, that's ok
    }

    console.log = originalLog;

    const helpText = logs.join("\n");
    expect(helpText).toContain("--safe");
    expect(helpText).toContain("--auto-resolve");
    expect(helpText).toContain("three-way merge");
  });

  it("validates --auto-resolve requires --safe", async () => {
    const testDirPath = join(originalCwd, TEST_DIR);
    const configPath = join(testDirPath, ".aligntrue", "config.yaml");
    const lockfilePath = join(testDirPath, ".aligntrue.lock.json");
    const allowListPath = join(testDirPath, ".aligntrue", "allow.yaml");

    writeFileSync(
      configPath,
      `mode: team
spec_version: "1"
`,
    );

    writeFileSync(
      lockfilePath,
      JSON.stringify({
        version: "1",
        generated_at: new Date().toISOString(),
        mode: "team",
        rules: [],
        bundle_hash: "test-hash",
      }),
    );

    writeFileSync(
      allowListPath,
      `sources: []
`,
    );

    // Change to test directory
    process.chdir(testDirPath);

    // Auto-resolve without --safe should be ignored (no effect)
    let exitCode = 0;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error("EXIT");
    }) as never;

    try {
      await update([
        "apply",
        "--auto-resolve",
        "ours",
        "--config",
        ".aligntrue/config.yaml",
      ]);
    } catch {
      // Expected
    }

    process.exit = originalExit;

    // Should work (auto-resolve is ignored when safe mode is off)
    expect(exitCode).toBe(0);
  });
});

/**
 * Recursively clean up test directory
 */
function cleanupTestDir(dir: string): void {
  if (!existsSync(dir)) return;

  const files = readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = join(dir, file.name);
    if (file.isDirectory()) {
      cleanupTestDir(fullPath);
      rmdirSync(fullPath);
    } else {
      unlinkSync(fullPath);
    }
  }

  if (existsSync(dir)) {
    try {
      rmdirSync(dir);
    } catch {
      // May fail if not empty, that's ok
    }
  }
}
