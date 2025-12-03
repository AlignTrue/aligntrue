/**
 * Plugs CLI End-to-End Integration Tests
 *
 * Tests the plugs command subcommands:
 * - plugs list: Show slots and fills
 * - plugs set: Add or update a fill value
 * - plugs unset: Remove a fill value
 * - plugs resolve: Preview plug resolution
 * - plugs validate: Check for errors
 *
 * Note: Skipped on Windows CI due to persistent file locking issues.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { plugsCommand } from "../../src/commands/plugs.js";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;
let exitCode: number | undefined;
let consoleOutput: string[];

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();
  originalCwd = process.cwd();
  exitCode = undefined;
  consoleOutput = [];

  // Create fresh test directory
  testProjectContext = setupTestProject({ skipFiles: true });
  TEST_DIR = testProjectContext.projectDir;

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock process.exit to capture exit code
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code})`);
  });

  // Capture console output
  vi.spyOn(console, "log").mockImplementation((...args) => {
    consoleOutput.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args) => {
    consoleOutput.push(args.join(" "));
  });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await testProjectContext.cleanup();
  vi.restoreAllMocks();
});

/**
 * Helper to create config with optional plugs fills
 * Note: Config only supports plugs.fills, not plugs.slots
 * Slots are defined in the Align IR (rules frontmatter)
 */
function createConfig(fills?: Record<string, string>) {
  const config: Record<string, unknown> = {
    sources: [{ type: "local", path: ".aligntrue/rules" }],
    exporters: ["cursor"],
  };
  if (fills && Object.keys(fills).length > 0) {
    config.plugs = { fills };
  }
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  writeFileSync(
    join(TEST_DIR, ".aligntrue", "config.yaml"),
    yaml.stringify(config),
    "utf-8",
  );
}

/**
 * Helper to create a rule with plugs
 */
function createRuleWithPlugs(filename: string, title: string, content: string) {
  const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
  mkdirSync(rulesDir, { recursive: true });

  const ruleContent = `---
title: "${title}"
---

# ${title}

${content}
`;
  writeFileSync(join(rulesDir, filename), ruleContent, "utf-8");
}

/**
 * Helper to execute plugs command
 */
async function executePlugs(args: string[] = []) {
  try {
    await plugsCommand(args);
  } catch {
    // Expected - command exits via process.exit
  }
}

/**
 * Helper to get config fills
 */
function getConfigFills(): Record<string, string> | undefined {
  const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
  const content = readFileSync(configPath, "utf-8");
  const config = yaml.parse(content);
  return config.plugs?.fills;
}

describeSkipWindows("Plugs CLI Integration", () => {
  describe("plugs --help", () => {
    it("shows help text and exits with 0", async () => {
      createConfig();
      createRuleWithPlugs("test.md", "Test", "Content");

      await executePlugs(["--help"]);

      expect(exitCode).toBe(0);
      const output = consoleOutput.join("\n");
      expect(output).toContain("plugs");
      expect(output).toContain("list");
      expect(output).toContain("set");
      expect(output).toContain("unset");
    });
  });

  describe("plugs list", () => {
    it("shows message when no plugs defined", async () => {
      createConfig();
      createRuleWithPlugs("simple.md", "Simple Rule", "No plugs here.");

      await executePlugs(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("No plugs defined");
    });

    it("shows fills from config", async () => {
      createConfig({
        "test.cmd": "pnpm test",
      });
      createRuleWithPlugs("testing.md", "Testing", "Run [[plug:test.cmd]]");

      await executePlugs(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("test.cmd");
      expect(output).toContain("pnpm test");
    });

    it("shows multiple fills", async () => {
      createConfig({
        "test.cmd": "pnpm test",
        "docs.url": "https://example.com",
      });
      createRuleWithPlugs("testing.md", "Testing", "Run tests and check docs.");

      await executePlugs(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("test.cmd");
      expect(output).toContain("docs.url");
    });
  });

  describe("plugs set", () => {
    it("sets a fill value in config", async () => {
      createConfig();
      createRuleWithPlugs("testing.md", "Testing", "Run the command.");

      await executePlugs(["set", "test.cmd", "pnpm test"]);

      // Verify fill was saved to config
      const fills = getConfigFills();
      expect(fills).toBeDefined();
      expect(fills?.["test.cmd"]).toBe("pnpm test");
    });

    it("shows success message after setting", async () => {
      createConfig();
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["set", "mySlot", "myValue"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("Set plug fill");
      expect(output).toContain("mySlot");
      expect(output).toContain("myValue");
    });

    it("updates existing fill value", async () => {
      createConfig({
        "test.cmd": "old value",
      });
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["set", "test.cmd", "new value"]);

      const fills = getConfigFills();
      expect(fills?.["test.cmd"]).toBe("new value");
    });

    it("errors when slot and value not provided", async () => {
      createConfig();
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["set"]);

      // Exits with error (1 or 2 depending on error path)
      expect(exitCode).toBeGreaterThanOrEqual(1);
      const output = consoleOutput.join("\n");
      expect(output).toMatch(/requires|required|slot|value/i);
    });

    it("validates URL format for .url slots", async () => {
      createConfig();
      createRuleWithPlugs("docs.md", "Docs", "See docs.");

      await executePlugs(["set", "docs.url", "not-a-url"]);

      expect(exitCode).toBe(1);
      const output = consoleOutput.join("\n");
      expect(output).toContain("Validation failed");
    });

    it("accepts valid URL for .url slots", async () => {
      createConfig();
      createRuleWithPlugs("docs.md", "Docs", "See docs.");

      await executePlugs(["set", "docs.url", "https://example.com/docs"]);

      const fills = getConfigFills();
      expect(fills?.["docs.url"]).toBe("https://example.com/docs");
    });

    it("validates command format for .cmd slots", async () => {
      createConfig();
      createRuleWithPlugs("test.md", "Test", "Run tests.");

      // Absolute paths should fail command validation
      await executePlugs(["set", "test.cmd", "/usr/bin/test"]);

      expect(exitCode).toBe(1);
      const output = consoleOutput.join("\n");
      expect(output).toContain("Validation failed");
    });

    it("accepts valid command for .cmd slots", async () => {
      createConfig();
      createRuleWithPlugs("test.md", "Test", "Run tests.");

      await executePlugs(["set", "test.cmd", "pnpm test"]);

      const fills = getConfigFills();
      expect(fills?.["test.cmd"]).toBe("pnpm test");
    });
  });

  describe("plugs unset", () => {
    it("removes a fill from config", async () => {
      createConfig({
        "test.cmd": "pnpm test",
        "other.value": "keep me",
      });
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["unset", "test.cmd"]);

      const fills = getConfigFills();
      expect(fills?.["test.cmd"]).toBeUndefined();
      expect(fills?.["other.value"]).toBe("keep me");
    });

    it("shows success message after unsetting", async () => {
      createConfig({
        "test.cmd": "pnpm test",
      });
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["unset", "test.cmd"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("Removed plug fill");
      expect(output).toContain("test.cmd");
    });

    it("errors when slot not found", async () => {
      createConfig({
        "existing.slot": "value",
      });
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["unset", "nonexistent.slot"]);

      expect(exitCode).toBe(1);
      const output = consoleOutput.join("\n");
      expect(output).toContain("No fill found");
    });

    it("errors when slot name not provided", async () => {
      createConfig({
        "test.cmd": "pnpm test",
      });
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["unset"]);

      // Exits with error (1 or 2 depending on error path)
      expect(exitCode).toBeGreaterThanOrEqual(1);
      const output = consoleOutput.join("\n");
      expect(output).toMatch(/requires|required|slot/i);
    });

    it("cleans up empty plugs object", async () => {
      createConfig({
        "only.fill": "value",
      });
      createRuleWithPlugs("testing.md", "Testing", "Content");

      await executePlugs(["unset", "only.fill"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const content = readFileSync(configPath, "utf-8");
      const config = yaml.parse(content);

      // plugs object should be removed when empty
      expect(config.plugs).toBeUndefined();
    });
  });

  describe("plugs resolve", () => {
    it("shows resolved rules count", async () => {
      createConfig({
        "test.cmd": "pnpm test",
      });
      createRuleWithPlugs("testing.md", "Testing", "Run [[plug:test.cmd]]");

      await executePlugs(["resolve"]);

      const output = consoleOutput.join("\n");
      // Check for successful resolution indicators
      expect(output).toMatch(/Resolved|Complete|successfully/i);
    });

    it("handles rules without plugs", async () => {
      createConfig();
      createRuleWithPlugs("simple.md", "Simple", "No plugs here.");

      await executePlugs(["resolve"]);

      const output = consoleOutput.join("\n");
      expect(output).toMatch(/No plugs to resolve|Complete/i);
    });
  });

  describe("plugs validate", () => {
    it("completes validation with fills provided", async () => {
      createConfig({
        "test.cmd": "pnpm test",
      });
      createRuleWithPlugs("testing.md", "Testing", "Run the command.");

      await executePlugs(["validate"]);

      const output = consoleOutput.join("\n");
      // Should complete validation
      expect(output).toMatch(/Validation|Complete/i);
    });

    it("completes validation for rules without plugs", async () => {
      createConfig();
      createRuleWithPlugs("simple.md", "Simple", "No plugs here.");

      await executePlugs(["validate"]);

      const output = consoleOutput.join("\n");
      expect(output).toMatch(/No plugs to validate|Complete/i);
    });

    it("shows fills without declared slots in output", async () => {
      createConfig({
        "undeclared.fill": "some value",
      });
      createRuleWithPlugs("rule.md", "Rule", "Content without plugs.");

      await executePlugs(["validate"]);

      // Should complete (fills without slots just show info, not error)
      const output = consoleOutput.join("\n");
      expect(output).toMatch(/Validation|Complete/i);
    });
  });

  describe("error handling", () => {
    it("errors on unknown subcommand", async () => {
      createConfig();
      createRuleWithPlugs("test.md", "Test", "Content");

      await executePlugs(["unknown"]);

      expect(exitCode).toBe(2);
      const output = consoleOutput.join("\n");
      expect(output).toContain("Unknown subcommand");
    });

    it("errors when no subcommand provided", async () => {
      createConfig();
      createRuleWithPlugs("test.md", "Test", "Content");

      await executePlugs([]);

      expect(exitCode).toBe(2);
      const output = consoleOutput.join("\n");
      expect(output).toContain("Subcommand required");
    });
  });

  describe("workflow integration", () => {
    it("set -> list -> unset workflow", async () => {
      createConfig();
      createRuleWithPlugs("testing.md", "Testing", "Test content.");

      // Set a fill
      await executePlugs(["set", "workflow.test", "test-value"]);
      expect(getConfigFills()?.["workflow.test"]).toBe("test-value");

      // Reset for next command
      consoleOutput = [];
      exitCode = undefined;

      // List should show the fill
      await executePlugs(["list"]);
      const listOutput = consoleOutput.join("\n");
      expect(listOutput).toContain("workflow.test");
      expect(listOutput).toContain("test-value");

      // Reset for next command
      consoleOutput = [];
      exitCode = undefined;

      // Unset the fill
      await executePlugs(["unset", "workflow.test"]);
      expect(getConfigFills()?.["workflow.test"]).toBeUndefined();
    });
  });
});
