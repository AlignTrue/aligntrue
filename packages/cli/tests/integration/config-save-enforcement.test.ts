/**
 * Enforcement test: ensure CLI commands use saveConfigAuto instead of saveConfig
 *
 * This test scans all CLI command files to ensure they don't use saveConfig directly.
 * Using saveConfig directly can cause config bloat in solo mode by writing all default values.
 *
 * Allowed patterns:
 * - saveConfigAuto (auto-selects minimal for solo mode)
 * - saveMinimalConfig (explicit minimal save)
 * - Dynamic imports that use saveConfigAuto
 *
 * Not allowed:
 * - Direct saveConfig( calls in command files
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const CLI_SRC_DIR = join(process.cwd(), "packages/cli/src");

/**
 * Get all TypeScript files recursively from a directory
 */
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getTypeScriptFiles(fullPath));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a file uses saveConfig directly (not saveConfigAuto or saveMinimalConfig)
 */
function checkForDirectSaveConfig(filePath: string): {
  hasBadPattern: boolean;
  lines: number[];
} {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const badLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip import lines - imports are fine
    if (line.includes("import ")) continue;

    // Skip comment lines
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

    // Check for direct saveConfig( calls (not saveConfigAuto or saveMinimalConfig)
    // This regex matches saveConfig( but not saveConfigAuto( or saveMinimalConfig(
    const directSaveConfigPattern = /\bsaveConfig\s*\(/;
    const autoPattern = /saveConfigAuto\s*\(/;
    const minimalPattern = /saveMinimalConfig\s*\(/;

    if (
      directSaveConfigPattern.test(line) &&
      !autoPattern.test(line) &&
      !minimalPattern.test(line)
    ) {
      badLines.push(i + 1); // 1-indexed line numbers
    }
  }

  return {
    hasBadPattern: badLines.length > 0,
    lines: badLines,
  };
}

describe("Config save enforcement", () => {
  it("CLI commands should not use saveConfig directly", () => {
    const commandsDir = join(CLI_SRC_DIR, "commands");
    const wizardsDir = join(CLI_SRC_DIR, "wizards");

    // Directories to scan
    const dirsToScan = [commandsDir, wizardsDir].filter((dir) => {
      try {
        statSync(dir);
        return true;
      } catch {
        return false;
      }
    });

    const violations: Array<{ file: string; lines: number[] }> = [];

    for (const dir of dirsToScan) {
      const files = getTypeScriptFiles(dir);

      for (const file of files) {
        // Whitelist: config.ts uses raw YAML read/write, not loadConfig flow
        // This is intentional - config set/unset operates on raw YAML without applying defaults
        if (file.endsWith("config.ts")) continue;

        const result = checkForDirectSaveConfig(file);
        if (result.hasBadPattern) {
          violations.push({
            file: file.replace(process.cwd() + "/", ""),
            lines: result.lines,
          });
        }
      }
    }

    if (violations.length > 0) {
      const message = violations
        .map((v) => `  ${v.file} (lines: ${v.lines.join(", ")})`)
        .join("\n");

      expect.fail(
        `Found direct saveConfig( usage in CLI commands. Use saveConfigAuto instead:\n${message}\n\n` +
          "saveConfigAuto auto-selects minimal config for solo mode, preventing config bloat.",
      );
    }

    expect(violations).toHaveLength(0);
  });
});
