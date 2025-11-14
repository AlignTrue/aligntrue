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

const CLI_PATH = join(__dirname, "../../dist/index.js");

// List of all commands (derived from packages/cli/src/commands/)
const ALL_COMMANDS = [
  "init",
  "sync",
  "watch",
  "check",
  "adapters",
  "sources",
  "scopes",
  "team",
  "link",
  "drift",
  "update",
  "onboard",
  "override",
  "plugs",
  "config",
  "backup",
  "revert",
  "telemetry",
  "privacy",
  "migrate",
];

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
        try {
          const output = execSync(`node ${CLI_PATH} ${command} --help`, {
            encoding: "utf-8",
            stdio: "pipe",
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
