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
    const ir = `id: demo
version: 1.0.0
spec_version: "1"
sections:
  - heading: TypeScript strict mode
    fingerprint: typescript-strict-mode
    summary: Tighten TypeScript compiler options
  - heading: Test coverage baseline
    summary: Maintain unit test coverage
`;

    writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

    await overrideSelectors([]);

    const output = consoleSpy.mock.calls
      .map((call) => call.join(" "))
      .join("\n");
    expect(output).toContain("sections[0]");
    expect(output).toContain("rule[id=typescript-strict-mode]");
    expect(output).toContain("sections[1]");
  });
});
