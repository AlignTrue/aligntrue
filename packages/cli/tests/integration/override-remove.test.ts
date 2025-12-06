import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { overrideCommand } from "../../src/commands/override.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  select: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
}));

vi.mock("../../src/utils/tty-helper.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/utils/tty-helper.js")
  >("../../src/utils/tty-helper.js");
  return {
    ...actual,
    isTTY: () => false,
  };
});

describe("override remove (non-interactive)", () => {
  const TEST_DIR = join(process.cwd(), "tests", "tmp", "override-remove");
  const aligntrueDir = join(TEST_DIR, ".aligntrue");
  let originalCwd: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalCwd = process.cwd();
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(join(aligntrueDir, "rules"), { recursive: true });

    // Minimal config with one overlay
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      [
        "mode: solo",
        "exporters:",
        "  - agents",
        "overlays:",
        "  overrides:",
        "    - selector: rule[id=testing]",
        "      set:",
        "        severity: error",
      ].join("\n"),
      "utf-8",
    );

    process.chdir(TEST_DIR);
    vi.clearAllMocks();

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      const err = new Error("process.exit called");
      (err as any).exitCode = code ?? 0;
      throw err;
    }) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("fails in non-interactive mode without confirmation", async () => {
    await expect(
      overrideCommand(["remove", "--selector", "rule[id=testing]"]),
    ).rejects.toMatchObject({
      exitCode: 1,
    });
  });

  it("removes overlay in non-interactive mode with --yes", async () => {
    await overrideCommand([
      "remove",
      "--selector",
      "rule[id=testing]",
      "--yes",
    ]);

    const configContent = readFileSync(
      join(aligntrueDir, "config.yaml"),
      "utf-8",
    );
    expect(configContent).not.toContain("rule[id=testing]");
  });
});
