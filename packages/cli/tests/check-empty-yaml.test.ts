/**
 * Check command tests for empty/invalid YAML
 * Verifies that empty or comments-only YAML files are handled gracefully
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

describe("Check Command - Empty YAML Handling", () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("handles empty YAML file gracefully", () => {
    // Create config
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `mode: solo
sources:
  - type: local
    path: .aligntrue/rules.yaml`,
    );

    // Create empty rules file
    writeFileSync(join(TEST_DIR, ".aligntrue/rules.yaml"), "");

    // Run check command
    try {
      execFileSync("node", [CLI_BIN, "check", "--ci"], {
        cwd: TEST_DIR,
        encoding: "utf8",
        stdio: "pipe",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      const output = error.stderr || error.stdout || "";
      expect(output).toContain("Empty or invalid rules file");
      expect(error.status).toBe(1);
    }
  });

  it("handles comments-only YAML file gracefully", () => {
    // Create config
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `mode: solo
sources:
  - type: local
    path: .aligntrue/rules.yaml`,
    );

    // Create comments-only rules file
    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules.yaml"),
      `# Just comments
# No actual content`,
    );

    // Run check command
    try {
      execFileSync("node", [CLI_BIN, "check", "--ci"], {
        cwd: TEST_DIR,
        encoding: "utf8",
        stdio: "pipe",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      const output = error.stderr || error.stdout || "";
      expect(output).toContain("Empty or invalid rules file");
      expect(error.status).toBe(1);
    }
  });

  it("validates valid YAML file successfully", () => {
    // Create config
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `mode: solo
sources:
  - type: local
    path: .aligntrue/rules.yaml`,
    );

    // Create valid rules file
    writeFileSync(
      join(TEST_DIR, ".aligntrue/rules.yaml"),
      `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: quality.typescript.strict
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Use strict TypeScript configuration`,
    );

    // Run check command - should succeed
    const output = execFileSync("node", [CLI_BIN, "check", "--ci"], {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    expect(output).toContain("passed");
  });
});
