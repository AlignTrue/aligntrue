import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { status } from "../../src/commands/status.js";
import { mockCommandArgs } from "../utils/command-test-helpers.js";

// Mock clack prompts to avoid noisy output during tests
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("status command", () => {
  let tempDir: string;
  let originalCwd: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = join(process.cwd(), `.status-test-${Date.now()}`);
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

  function writeBasicProject(): void {
    mkdirSync(".aligntrue/rules", { recursive: true });
    writeFileSync(
      ".aligntrue/config.yaml",
      [
        "mode: solo",
        "sources:",
        "  - type: local",
        "    path: .aligntrue/rules",
        "exporters:",
        "  - cursor",
        "  - agents",
      ].join("\n"),
      "utf-8",
    );
    // Create a simple rule file
    writeFileSync(
      ".aligntrue/rules/sample.md",
      "---\ntitle: Sample Rule\noriginal_source: test\n---\n\n## Sample\n\nSample content\n",
      "utf-8",
    );
    mkdirSync(".cursor/rules", { recursive: true });
    writeFileSync(".cursor/rules/sample.mdc", "## Sample", "utf-8");
    writeFileSync(".aligntrue/.last-sync", `${Date.now() - 60_000}`, "utf-8");
  }

  it("displays human-readable summary", async () => {
    writeBasicProject();

    await expect(status([])).resolves.toBeUndefined();

    const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(output).toContain("Mode: SOLO");
    expect(output).toContain("Exporters (2 configured)");
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("outputs JSON when --json flag is provided", async () => {
    writeBasicProject();
    const args = mockCommandArgs({ json: true });

    await expect(status(args)).resolves.toBeUndefined();

    const payload = logSpy.mock.calls.map((call) => call[0]).join("");
    const parsed = JSON.parse(payload);
    expect(parsed.mode).toBe("solo");
    expect(parsed.lockfile.enabled).toBe(false);
    expect(parsed.exporters.configured).toHaveLength(2);
  });

  it("errors when config file is missing", async () => {
    await expect(status([])).rejects.toThrow("process.exit: 1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
