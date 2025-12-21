/**
 * Command coverage test framework
 * Systematic testing of all CLI commands
 *
 * This test ensures all commands have basic coverage:
 * - Help text works
 * - Invalid arguments are handled
 * - Exit codes are correct
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { join } from "path";
import { readFileSync } from "fs";

const CLI_PATH = join(__dirname, "../../dist/index.js");

function discoverCommands(): string[] {
  const indexPath = join(__dirname, "../../src/commands/index.ts");
  const contents = readFileSync(indexPath, "utf-8");

  const exportsRegex = /export\s+\{\s*([^}]+?)\s*\}\s+from\s+["'][^"']+["']/g;
  const commands: string[] = [];

  let match;
  while ((match = exportsRegex.exec(contents)) !== null) {
    const clause = match[1];
    const entries = clause.split(",").map((entry) => entry.trim());
    for (const entry of entries) {
      if (!entry) continue;
      // Handle "foo as bar" alias form
      const [original, alias] = entry.split(/\s+as\s+/);
      commands.push((alias || original).trim());
    }
  }

  return commands;
}

const ALL_COMMANDS = discoverCommands();

const COMMAND_ENVS: Record<string, NodeJS.ProcessEnv> = {
  // Work commands are gated behind OPS_CORE_ENABLED; enable for help coverage.
  work: { OPS_CORE_ENABLED: "1" },
};

describe("Command Coverage", () => {
  describe("Help text", () => {
    it("shows help for main command", () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: "utf-8",
      });
      expect(output).toContain("AlignTrue CLI");
      expect(output).toContain("Usage:");
    });

    ALL_COMMANDS.forEach((command) => {
      it(`shows help for ${command} command`, () => {
        const env = { ...process.env, ...COMMAND_ENVS[command] };

        try {
          const output = execSync(`node ${CLI_PATH} ${command} --help`, {
            encoding: "utf-8",
            stdio: "pipe",
            env,
          });
          // Help text should contain usage information (case insensitive)
          expect(output.toLowerCase()).toMatch(/usage/);
        } catch (err: any) {
          // Some commands require subcommands and show error with usage
          // That's acceptable as long as it shows how to use the command
          const errorOutput = (err.stderr || err.stdout || "").toString();
          if (errorOutput.toLowerCase().includes("usage")) {
            // Error includes usage info, that's acceptable
            expect(errorOutput.toLowerCase()).toMatch(/usage/);
          } else {
            // No usage info in error, that's a bug
            throw err;
          }
        }
      });
    });
  });

  describe("Invalid command handling", () => {
    it("shows error for unknown command", () => {
      try {
        execSync(`node ${CLI_PATH} nonexistent-command`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.status).toBeGreaterThan(0);
        expect(err.stderr || err.stdout).toContain("not implemented");
      }
    });
  });

  describe("Version command", () => {
    it("shows version with --version", () => {
      const output = execSync(`node ${CLI_PATH} --version`, {
        encoding: "utf-8",
      });
      // Should show a version number
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });
});
