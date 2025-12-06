import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import * as clack from "@clack/prompts";
import { onboard } from "../../src/commands/onboard.js";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

describe("onboard --ci validation", () => {
  let project: TestProjectContext;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalCwd: string;

  beforeEach(() => {
    project = setupTestProject();
    originalCwd = process.cwd();
    process.chdir(project.projectDir);

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);

    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
    errorSpy.mockRestore();
    process.chdir(originalCwd);
    await project.cleanup();
  });

  it("fails with clear error when SARIF file is missing", async () => {
    const missingPath = join(project.projectDir, "missing.sarif");

    await expect(onboard(["--ci", missingPath])).rejects.toThrow(
      "process.exit(2)",
    );

    const errors = errorSpy.mock.calls.flat().join(" ");
    expect(errors).toContain("SARIF file not found");
    expect(errors).toContain(missingPath);
  });
});
