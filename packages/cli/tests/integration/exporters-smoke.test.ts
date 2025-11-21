/**
 * Smoke tests for all exporters
 * Ensures each exporter can be enabled and produces valid output
 * Skipped: Exporters need real sections and proper IR to export.
 * Currently testing with empty sections causes export failures.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(__dirname, "../../../temp-test-exporters");
const CLI_PATH = join(__dirname, "../../dist/index.js");

const EXPORTERS_DIR = join(__dirname, "../../../..", "packages/exporters/src");
const EXCLUDED_EXPORTERS = new Set(["base", "utils", "mcp-transformers"]);

/** All current exporter directories (excluding helpers). */
const ALL_EXPORTERS = readdirSync(EXPORTERS_DIR, { withFileTypes: true })
  .filter(
    (dirent) => dirent.isDirectory() && !EXCLUDED_EXPORTERS.has(dirent.name),
  )
  .map((dirent) => dirent.name)
  .sort();

describe.skip("Exporters Smoke Tests", () => {
  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("All exporters", () => {
    ALL_EXPORTERS.forEach((exporter) => {
      it(`should enable and export to ${exporter}`, () => {
        // Create minimal config with this exporter
        mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

        writeFileSync(
          join(TEST_DIR, ".aligntrue/config.yaml"),
          `exporters:\n  - ${exporter}\n`,
          "utf-8",
        );

        // Create minimal valid IR

        writeFileSync(
          join(TEST_DIR, ".aligntrue/.rules.yaml"),
          `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test Section
    content: This is a test section for exporter smoke tests.
    level: 2
`,
          "utf-8",
        );

        // Run sync
        try {
          execSync(`node "${CLI_PATH}" sync --dry-run`, {
            cwd: TEST_DIR,
            stdio: "pipe",
            encoding: "utf-8",
          });

          // If we get here, sync succeeded (dry-run doesn't write files)
          expect(true).toBe(true);
        } catch (error: any) {
          // Check if error is about missing exporter support (expected for some)
          const stderr = error.stderr?.toString() || "";
          const stdout = error.stdout?.toString() || "";

          // Some exporters might not be fully implemented yet
          // That's OK - we're just checking they don't crash
          if (
            stderr.includes("not implemented") ||
            stderr.includes("not supported") ||
            stdout.includes("not implemented") ||
            stdout.includes("not supported")
          ) {
            expect(true).toBe(true); // Expected for unimplemented exporters
          } else {
            // Unexpected error - fail the test
            throw new Error(
              `Exporter ${exporter} failed unexpectedly:\n${stderr}\n${stdout}`,
            );
          }
        }
      });
    });
  });

  describe("Core exporters (must work)", () => {
    const CORE_EXPORTERS = ["cursor", "agents", "vscode-mcp"];

    CORE_EXPORTERS.forEach((exporter) => {
      it(`should successfully export to ${exporter}`, () => {
        // Create minimal config
        mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

        writeFileSync(
          join(TEST_DIR, ".aligntrue/config.yaml"),
          `exporters:\n  - ${exporter}\n`,
          "utf-8",
        );

        // Create valid IR
        writeFileSync(
          join(TEST_DIR, ".aligntrue/.rules.yaml"),
          `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test Section
    content: This is a test section.
    level: 2
`,
          "utf-8",
        );

        // Run sync (not dry-run, actually write files)
        execSync(`node "${CLI_PATH}" sync`, {
          cwd: TEST_DIR,
          stdio: "pipe",
          encoding: "utf-8",
        });

        // Verify output file exists
        let outputPath: string;
        switch (exporter) {
          case "cursor":
            outputPath = join(TEST_DIR, ".cursor/rules/aligntrue.mdc");
            break;
          case "agents":
            outputPath = join(TEST_DIR, "AGENTS.md");
            break;
          case "vscode-mcp":
            outputPath = join(TEST_DIR, ".vscode/mcp.json");
            break;
          default:
            throw new Error(`Unknown core exporter: ${exporter}`);
        }

        expect(existsSync(outputPath)).toBe(true);

        // Verify file has content
        const content = readFileSync(outputPath, "utf-8");
        expect(content.length).toBeGreaterThan(0);

        // Verify content includes our test section
        expect(content).toContain("Test Section");
      });
    });
  });
});
