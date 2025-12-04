/**
 * Enforcement test: ensure CLI commands use patchConfig for updates
 *
 * This test scans all CLI command files to ensure they use the correct config save pattern:
 * - patchConfig: For surgical updates (add/remove/modify specific keys)
 * - saveConfig: Only for full config writes (init, migrate)
 *
 * Using saveConfig for updates can cause data loss by overwriting user configuration.
 *
 * Allowed patterns:
 * - patchConfig (surgical updates, preserves other keys)
 * - saveConfig in init.ts, migrate.ts (full config writes)
 *
 * Not allowed:
 * - saveConfig in other command files (use patchConfig instead)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";

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
 * Files allowed to use saveConfig (full writes)
 */
const SAVE_CONFIG_WHITELIST = [
  "init.ts", // Creates new config from scratch
  "migrate.ts", // Full config rewrite during migration
  "config.ts", // Raw YAML operations for config get/set
];

/**
 * Check if a file uses saveConfig (which should use patchConfig instead)
 */
function checkForSaveConfigMisuse(filePath: string): {
  hasBadPattern: boolean;
  lines: number[];
} {
  const fileName = basename(filePath);

  // Whitelist certain files that legitimately need full saves
  if (SAVE_CONFIG_WHITELIST.includes(fileName)) {
    return { hasBadPattern: false, lines: [] };
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const badLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip import lines - imports are fine
    if (line.includes("import ")) continue;

    // Skip comment lines
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

    // Check for saveConfig( calls - these should be patchConfig for updates
    const saveConfigPattern = /\bsaveConfig\s*\(/;
    const patchConfigPattern = /patchConfig\s*\(/;

    if (saveConfigPattern.test(line) && !patchConfigPattern.test(line)) {
      badLines.push(i + 1); // 1-indexed line numbers
    }
  }

  return {
    hasBadPattern: badLines.length > 0,
    lines: badLines,
  };
}

describe("Config save enforcement", () => {
  it("CLI commands should use patchConfig for updates, not saveConfig", () => {
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
        const result = checkForSaveConfigMisuse(file);
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
        `Found saveConfig usage in CLI commands that should use patchConfig:\n${message}\n\n` +
          "Use patchConfig for surgical updates to preserve user configuration.\n" +
          "saveConfig is only appropriate for full config writes (init, migrate).",
      );
    }

    expect(violations).toHaveLength(0);
  });
});
