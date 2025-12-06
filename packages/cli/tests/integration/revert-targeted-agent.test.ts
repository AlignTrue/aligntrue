import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import { BackupManager } from "@aligntrue/core";
import { sync } from "../../src/commands/sync/index.js";
import { revert } from "../../src/commands/revert.js";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let project: TestProjectContext;
let exitSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  project = setupTestProject();
  process.chdir(project.projectDir);

  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined as never) as never);

  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  };
  vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.log.success).mockImplementation(() => {});
  vi.mocked(clack.log.info).mockImplementation(() => {});
  vi.mocked(clack.log.warn).mockImplementation(() => {});
  vi.mocked(clack.log.error).mockImplementation(() => {});
});

afterEach(async () => {
  exitSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  await project.cleanup();
});

describe("revert restores missing agent files", () => {
  it("restores AGENTS.md with --latest when file is missing", async () => {
    await sync([]);

    // Ensure backup includes AGENTS.md for restore
    const backup = BackupManager.createBackup({
      cwd: project.projectDir,
      agentFilePatterns: ["AGENTS.md"],
    });

    const agentsPath = join(project.projectDir, "AGENTS.md");
    expect(existsSync(agentsPath)).toBe(true);
    const original = readFileSync(agentsPath, "utf-8");

    rmSync(agentsPath);
    expect(existsSync(agentsPath)).toBe(false);

    await revert(["AGENTS.md", "--timestamp", backup.timestamp, "--yes"]);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(existsSync(agentsPath)).toBe(true);
    expect(readFileSync(agentsPath, "utf-8")).toBe(original);
  });

  it("surfaces a clear warning when backup mode differs from current mode", async () => {
    await sync([]);

    // Create a backup that records a different mode than the current config
    const backup = BackupManager.createBackup({
      cwd: project.projectDir,
      mode: "team",
      agentFilePatterns: ["AGENTS.md"],
    });

    await revert(["--timestamp", backup.timestamp, "--yes"]);

    expect(exitSpy).not.toHaveBeenCalled();

    const warnCalls = vi.mocked(clack.log.warn).mock.calls.flat().join(" ");
    const consoleWarns = consoleWarnSpy.mock.calls.flat().join(" ");
    const allWarnings = `${warnCalls} ${consoleWarns}`;
    expect(allWarnings).toContain("Mode mismatch detected");
    expect(allWarnings).toContain("Current mode");
    expect(allWarnings).toContain("Backup mode");
  });
});
