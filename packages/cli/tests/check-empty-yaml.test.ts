/**
 * Check command tests for rules directory validation
 * Verifies that empty or invalid rules directories are handled gracefully
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = join(__dirname, "..");
const CLI_BIN = join(CLI_ROOT, "dist/index.js");
const TEST_DIR = join(__dirname, "temp-check-empty-yaml-test");

describe("Check Command - Rules Directory Handling", () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue/rules"), { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("handles empty rules directory gracefully", () => {
    // Create config
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `mode: solo
sources:
  - type: local
    path: .aligntrue/rules`,
    );

    // Rules directory exists but is empty
    // Run check command - should report no rules found or pass silently
    const output = execFileSync("node", [CLI_BIN, "check", "--ci"], {
      cwd: TEST_DIR,
      encoding: "utf8",
      stdio: "pipe",
    });

    // Empty rules directory is valid (no rules to check)
    expect(output).toContain("passed");
  });

  it("handles rules directory with non-rule files gracefully", () => {
    // Create config
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `mode: solo
sources:
  - type: local
    path: .aligntrue/rules`,
    );

    // Create a non-rule file (e.g., .gitkeep or README)
    writeFileSync(join(TEST_DIR, ".aligntrue/rules/.gitkeep"), "");
    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules/README.txt"),
      "Not a markdown rule",
    );

    // Run check command - should pass (no valid .md rules to check)
    const output = execFileSync("node", [CLI_BIN, "check", "--ci"], {
      cwd: TEST_DIR,
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(output).toContain("passed");
  });

  it("validates valid markdown rule file successfully", () => {
    // Create config
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `mode: solo
sources:
  - type: local
    path: .aligntrue/rules`,
    );

    // Create valid markdown rule file
    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules/typescript.md"),
      `---
title: TypeScript Quality
description: Use strict TypeScript configuration
---

# TypeScript Quality

Use strict TypeScript configuration for better type safety.`,
    );

    // Run check command - should succeed
    const output = execFileSync("node", [CLI_BIN, "check", "--ci"], {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    expect(output).toContain("passed");
  });
});
