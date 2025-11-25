import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { cleanupDir } from "../helpers/fs-cleanup.js";
import { overrideSelectors } from "../../src/commands/override-selectors.js";

const ORIGINAL_CWD = process.cwd();
let TEST_DIR: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-override-selectors-"));
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  process.chdir(TEST_DIR);
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  consoleSpy.mockRestore();
  process.chdir(ORIGINAL_CWD);
  await cleanupDir(TEST_DIR);
});

describe("override selectors command", () => {
  it("lists selectors for sections and rule IDs", async () => {
    // Create config file
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "exporters:\n  - cursor\n",
      "utf-8",
    );

    // Create rules directory with markdown files
    const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "typescript-strict-mode.md"),
      "## TypeScript strict mode\n\nTighten TypeScript compiler options\n",
      "utf-8",
    );
    writeFileSync(
      join(rulesDir, "test-coverage-baseline.md"),
      "## Test coverage baseline\n\nMaintain unit test coverage\n",
      "utf-8",
    );

    await overrideSelectors([]);

    const output = consoleSpy.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(output).toContain("sections[0]");
    expect(output).toContain("sections[1]");
  });
});
