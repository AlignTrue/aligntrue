/**
 * Remote backup setup should be scriptable with flags.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import yaml from "yaml";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";
import { backupCommand } from "../../src/commands/backup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Backup setup non-interactive flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testProjectContext = setupTestProject();
    TEST_DIR = testProjectContext.projectDir;
    process.chdir(TEST_DIR);

    // Minimal AlignTrue structure
    const aligntrueDir = join(TEST_DIR, ".aligntrue");
    const rulesDir = join(aligntrueDir, "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "placeholder.md"), "# placeholder\n", "utf-8");

    const baseConfig = {
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["agents"],
      mode: "team",
      modules: { lockfile: true },
    };
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      yaml.stringify(baseConfig),
      "utf-8",
    );

    // Mock process.exit to throw so tests can catch
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Clack mocks
    const mockSpinner = { start: vi.fn(), stop: vi.fn() };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.text).mockResolvedValue("main");
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup();
  });

  it("writes remotes config via flags with --yes", async () => {
    const remoteUrl = "git@example.com:backup.git";
    const args = [
      "setup",
      "--yes",
      "--remote",
      remoteUrl,
      "--branch",
      "main",
      "--no-auto",
    ];

    try {
      await backupCommand(args);
    } catch {
      // process.exit mocked
    }

    const cfg = yaml.parse(
      readFileSync(join(TEST_DIR, ".aligntrue/config.yaml"), "utf-8"),
    );
    expect(cfg.remotes?.shared?.url).toBe(remoteUrl);
    expect(cfg.remotes?.shared?.branch).toBe("main");
    expect(cfg.remotes?.shared?.auto).toBe(false);
  });
});
