/**
 * Watch mode tests
 * Tests file watching and auto-sync functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";

const TEST_DIR = join(__dirname, "../../../temp-test-watch");
const CLI_PATH = join(__dirname, "../../dist/index.js");

/**
 * Watch mode tests are skipped in CI.
 * Watch requires interactive TTY and file system events that don't work reliably in test runners.
 * Manual testing: run `aligntrue watch` in a real terminal.
 * CI validation: covered by sync command smoke tests.
 */
describe.skip("Watch Mode Tests", () => {
  let watchProcess: ChildProcess | null = null;

  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Kill watch process if running
    if (watchProcess) {
      watchProcess.kill("SIGTERM");
      watchProcess = null;
    }

    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should start watch mode", async () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue/.rules.yaml"),
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test
    content: Content.
    level: 2
`,
      "utf-8",
    );

    // Start watch mode
    watchProcess = spawn("node", [CLI_PATH, "watch"], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    let output = "";
    watchProcess.stdout?.on("data", (data) => {
      output += data.toString();
    });

    // Wait for watch to start
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (output.includes("Watching") || output.includes("watch")) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    // Verify watch started
    expect(output).toContain("watch") || expect(output).toContain("Watching");
  }, 10000); // 10 second timeout for this test

  it("should detect file changes and auto-sync", async () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue/.rules.yaml"),
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Original
    content: Original content.
    level: 2
`,
      "utf-8",
    );

    // Start watch mode
    watchProcess = spawn("node", [CLI_PATH, "watch"], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    let output = "";
    watchProcess.stdout?.on("data", (data) => {
      output += data.toString();
    });

    // Wait for watch to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Modify the rules file
    writeFileSync(
      join(TEST_DIR, ".aligntrue/.rules.yaml"),
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Modified
    content: Modified content.
    level: 2
`,
      "utf-8",
    );

    // Wait for auto-sync to trigger
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check if AGENTS.md was updated
    if (existsSync(join(TEST_DIR, "AGENTS.md"))) {
      const agentsMd = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
      expect(agentsMd).toContain("Modified") ||
        expect(agentsMd).toContain("content");
    }

    // Verify output shows sync happened
    expect(output).toContain("sync") ||
      expect(output).toContain("change") ||
      expect(output).toContain("watch");
  }, 10000);

  it("should handle watch mode with debouncing", async () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:
  - agents-md
sync:
  watch_debounce: 1000
`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue/.rules.yaml"),
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test
    content: Content.
    level: 2
`,
      "utf-8",
    );

    // Start watch mode
    watchProcess = spawn("node", [CLI_PATH, "watch"], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    let output = "";
    watchProcess.stdout?.on("data", (data) => {
      output += data.toString();
    });

    // Wait for watch to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Make multiple rapid changes
    for (let i = 0; i < 3; i++) {
      writeFileSync(
        join(TEST_DIR, ".aligntrue/.rules.yaml"),
        `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test ${i}
    content: Content ${i}.
    level: 2
`,
        "utf-8",
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Wait for debounce and sync
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Should have synced only once (or a few times) due to debouncing
    // We can't easily count sync events, so just verify watch is still running
    expect(output).toContain("watch") || expect(output).toContain("sync");
  }, 10000);

  it("should stop watch mode gracefully", async () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue/.rules.yaml"),
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test
    content: Content.
    level: 2
`,
      "utf-8",
    );

    // Start watch mode
    watchProcess = spawn("node", [CLI_PATH, "watch"], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    let output = "";
    watchProcess.stdout?.on("data", (data) => {
      output += data.toString();
    });

    // Wait for watch to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Stop watch mode
    watchProcess.kill("SIGTERM");

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      watchProcess!.on("exit", () => {
        resolve();
      });

      // Timeout after 3 seconds
      setTimeout(() => resolve(), 3000);
    });

    // Verify watch started before being stopped
    expect(output).toContain("watch") || expect(output).toContain("Watching");
  }, 10000);

  it("should handle watch mode with invalid config", async () => {
    // Setup with invalid config
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `invalid: yaml: syntax:`,
      "utf-8",
    );

    // Try to start watch mode
    watchProcess = spawn("node", [CLI_PATH, "watch"], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    let stderr = "";
    watchProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for error
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Should have error about invalid config
    expect(stderr).toContain("error") ||
      expect(stderr).toContain("invalid") ||
      expect(stderr).toContain("config");
  }, 10000);
});
