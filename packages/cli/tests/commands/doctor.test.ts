import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { doctor } from "../../src/commands/doctor.js";
import { mockCommandArgs } from "../utils/command-test-helpers.js";

// Mock clack to keep output quiet
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("doctor command", () => {
  let tempDir: string;
  let originalCwd: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = join(process.cwd(), `.doctor-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    originalCwd = process.cwd();
    process.chdir(tempDir);

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    }) as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function writeHealthyProject(): void {
    mkdirSync(".aligntrue", { recursive: true });
    writeFileSync(
      ".aligntrue/config.yaml",
      [
        "version: '1'",
        "mode: solo",
        "modules:",
        "  lockfile: false",
        "exporters:",
        "  - cursor",
        "  - agents",
        "sync:",
        "  edit_source: .cursor/rules/*.mdc",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      ".aligntrue/.rules.yaml",
      "id: test\nversion: 1.0.0\nspec_version: '1'\nsections: []\n",
      "utf-8",
    );
    mkdirSync(".cursor/rules", { recursive: true });
    writeFileSync(".cursor/rules/aligntrue.mdc", "## Sample", "utf-8");
    writeFileSync("AGENTS.md", "# Sample\n", "utf-8");
  }

  it("prints health summary", async () => {
    writeHealthyProject();

    await expect(doctor([])).resolves.toBeUndefined();

    const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Config file");
    expect(output).toContain("Exporter: Cursor");
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("outputs JSON when requested", async () => {
    writeHealthyProject();
    const args = mockCommandArgs({ json: true });

    await expect(doctor(args)).resolves.toBeUndefined();

    const payload = logSpy.mock.calls.map((call) => call[0]).join("");
    const parsed = JSON.parse(payload);
    expect(parsed.summary.ok).toBeGreaterThan(0);
    expect(parsed.summary.error).toBe(0);
  });

  it("fails when config is missing", async () => {
    await expect(doctor([])).rejects.toThrow("process.exit: 1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("warns when exporter outputs are missing", async () => {
    writeHealthyProject();
    // Remove Cursor file to trigger warning
    rmSync(".cursor/rules/aligntrue.mdc");

    await expect(doctor([])).resolves.toBeUndefined();

    const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain(".cursor/rules/*.mdc");
  });
});
