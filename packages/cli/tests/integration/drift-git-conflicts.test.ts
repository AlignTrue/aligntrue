/**
 * Drift should fail fast when git conflicts are present.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";
import { drift } from "../../src/commands/drift.js";
import * as childProcess from "child_process";

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Drift detects git conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testProjectContext = setupTestProject();
    TEST_DIR = testProjectContext.projectDir;
    process.chdir(TEST_DIR);

    // Minimal AlignTrue setup
    const aligntrueDir = join(TEST_DIR, ".aligntrue");
    mkdirSync(join(aligntrueDir, "rules"), { recursive: true });
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      `mode: team
modules:
  lockfile: true
sources:
  - type: local
    path: .aligntrue/rules
`,
      "utf-8",
    );

    // Mock process.exit to throw so we can assert
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Clack mocks
    const mockSpinner = { start: vi.fn(), stop: vi.fn() };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup();
  });

  it("exits with guidance when git conflicts are present", async () => {
    vi.mocked(childProcess.execSync).mockReturnValue("UU rules.md\n");

    await expect(
      (async () => {
        await drift([]);
      })(),
    ).rejects.toThrow(/git conflicts|process\.exit/i);
  });
});
