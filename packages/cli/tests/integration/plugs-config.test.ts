/**
 * Integration tests for plugs config-based fills
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { plugsCommand } from "../../src/commands/plugs.js";

describe("plugs config integration", () => {
  let testDir: string;
  let originalCwd: string;
  let originalExit: typeof process.exit;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let exitCode: number | undefined;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    // Create temp directory
    testDir = join(
      tmpdir(),
      `plugs-config-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    );
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, ".aligntrue"), { recursive: true });

    // Save original state
    originalCwd = process.cwd();
    originalExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Change to test directory
    process.chdir(testDir);

    // Mock process.exit
    exitCode = undefined;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    // Capture console output
    logOutput = [];
    errorOutput = [];
    console.log = (...args: unknown[]) => {
      logOutput.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errorOutput.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    // Restore original state
    process.chdir(originalCwd);
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("sets a fill in config.yaml", async () => {
    // Create minimal config
    const configPath = join(testDir, ".aligntrue/config.yaml");
    writeFileSync(
      configPath,
      `version: "1"\nmode: solo\nexporters:\n  - agents\n`,
    );

    // Create IR with slot
    const irPath = join(testDir, ".aligntrue/.rules.yaml");
    writeFileSync(
      irPath,
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: "Test"
    content: "Run: [[plug:test.cmd]]"
    level: 2
    fingerprint: "test"
plugs:
  slots:
    test.cmd:
      description: "Test command"
      format: command
      required: true
      example: "pytest -q"
`,
    );

    // Set fill
    try {
      await plugsCommand(["set", "test.cmd", "pnpm test"]);
    } catch (err) {
      // Ignore process.exit error
      if (!(err instanceof Error && err.message.includes("process.exit"))) {
        throw err;
      }
    }

    // Verify config was updated
    const config = readFileSync(configPath, "utf-8");
    expect(config).toContain("plugs:");
    expect(config).toContain("fills:");
    expect(config).toContain('test.cmd: "pnpm test"');

    // Verify success message
    expect(logOutput.join("\n")).toContain("Set plug fill");
    expect(logOutput.join("\n")).toContain("test.cmd");
  });

  it("validates fill format", async () => {
    // Create minimal config
    const configPath = join(testDir, ".aligntrue/config.yaml");
    writeFileSync(
      configPath,
      `version: "1"\nmode: solo\nexporters:\n  - agents\n`,
    );

    // Create IR with slot
    const irPath = join(testDir, ".aligntrue/.rules.yaml");
    writeFileSync(
      irPath,
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections: []
plugs:
  slots:
    test.cmd:
      description: "Test command"
      format: command
      required: true
`,
    );

    // Try to set invalid fill (absolute path)
    try {
      await plugsCommand(["set", "test.cmd", "/usr/bin/test"]);
    } catch (err) {
      // Ignore process.exit error
      if (!(err instanceof Error && err.message.includes("process.exit"))) {
        throw err;
      }
    }

    // Verify validation error
    expect(errorOutput.join("\n")).toContain("Validation failed");
    expect(errorOutput.join("\n")).toContain("absolute path");
    expect(exitCode).toBe(1);
  });

  it("unsets a fill from config.yaml", async () => {
    // Create config with fill
    const configPath = join(testDir, ".aligntrue/config.yaml");
    writeFileSync(
      configPath,
      `version: "1"
mode: solo
plugs:
  fills:
    test.cmd: "pnpm test"
exporters:
  - agents
`,
    );

    // Create minimal IR
    const irPath = join(testDir, ".aligntrue/.rules.yaml");
    writeFileSync(
      irPath,
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections: []
`,
    );

    // Unset fill
    try {
      await plugsCommand(["unset", "test.cmd"]);
    } catch (err) {
      // Ignore process.exit error
      if (!(err instanceof Error && err.message.includes("process.exit"))) {
        throw err;
      }
    }

    // Verify config was updated
    const config = readFileSync(configPath, "utf-8");
    expect(config).not.toContain("test.cmd");

    // Verify success message
    expect(logOutput.join("\n")).toContain("Removed plug fill");
    expect(logOutput.join("\n")).toContain("test.cmd");
  });

  it("shows config fills in list command", async () => {
    // Create config with fill
    const configPath = join(testDir, ".aligntrue/config.yaml");
    writeFileSync(
      configPath,
      `version: "1"
mode: solo
plugs:
  fills:
    test.cmd: "pnpm test"
exporters:
  - agents
`,
    );

    // Create IR with slot
    const irPath = join(testDir, ".aligntrue/.rules.yaml");
    writeFileSync(
      irPath,
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections: []
plugs:
  slots:
    test.cmd:
      description: "Test command"
      format: command
      required: true
`,
    );

    // List plugs
    try {
      await plugsCommand(["list"]);
    } catch (err) {
      // Ignore process.exit error
      if (!(err instanceof Error && err.message.includes("process.exit"))) {
        throw err;
      }
    }

    // Verify output shows config fill
    const output = logOutput.join("\n");
    expect(output).toContain("test.cmd");
    expect(output).toContain("pnpm test");
    expect(output).toContain("from config");
  });
});
