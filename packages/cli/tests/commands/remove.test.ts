import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";

const confirmMock = vi.fn();
const cancelMock = vi.fn();
const isTTYMock = vi.fn(() => true);
const spinnerStartMock = vi.fn();
const spinnerStopMock = vi.fn();
const patchConfigMock = vi.fn(
  async (patch: unknown, configPath: string): Promise<void> => {
    const current = yaml.parse(readFileSync(configPath, "utf-8")) || {};
    const next = { ...current, ...(patch as object) };
    writeFileSync(configPath, yaml.stringify(next), "utf-8");
  },
);
const loadConfigMock = vi.fn(async (configPath: string) =>
  yaml.parse(readFileSync(configPath, "utf-8")),
);

vi.mock("@clack/prompts", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  confirm: confirmMock,
  isCancel: vi.fn(() => false),
  cancel: cancelMock,
  outro: vi.fn(),
}));

vi.mock("../../src/utils/tty-helper.js", () => ({
  isTTY: isTTYMock,
}));

vi.mock("../../src/utils/spinner.js", () => ({
  createManagedSpinner: vi.fn(() => ({
    start: spinnerStartMock,
    stop: spinnerStopMock,
    stopSilent: vi.fn(),
  })),
}));

vi.mock("@aligntrue/core", () => ({
  patchConfig: patchConfigMock,
}));

vi.mock("../../src/utils/config-loader.js", () => ({
  loadConfigWithValidation: loadConfigMock,
}));

describe("remove command", () => {
  const testDir = join(__dirname, "..", "..", "..", "temp-remove-cli-test");
  const aligntrueDir = join(testDir, ".aligntrue");
  const configPath = join(aligntrueDir, "config.yaml");
  const sourceUrl = "https://github.com/org/rules";
  let originalCwd: string;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    originalCwd = process.cwd();

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    mkdirSync(join(aligntrueDir, "rules"), { recursive: true });

    const config = {
      version: "1",
      mode: "solo",
      sources: [
        { type: "git", url: sourceUrl },
        { type: "local", path: ".aligntrue/rules" },
      ],
      exporters: ["agents"],
    };

    writeFileSync(configPath, yaml.stringify(config), "utf-8");
    process.chdir(testDir);

    confirmMock.mockResolvedValue(true);
    isTTYMock.mockReturnValue(true);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("skips confirmation when --yes is provided", async () => {
    const { remove } = await import("../../src/commands/remove.js");

    await remove(["link", sourceUrl, "--yes"]);

    expect(confirmMock).not.toHaveBeenCalled();
    expect(patchConfigMock).toHaveBeenCalledTimes(1);

    const updated = yaml.parse(readFileSync(configPath, "utf-8"));
    expect(updated.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
  });

  it("cancels removal when confirmation is denied", async () => {
    confirmMock.mockResolvedValueOnce(false);
    const { remove } = await import("../../src/commands/remove.js");

    await remove(["link", sourceUrl]);

    expect(confirmMock).toHaveBeenCalled();
    expect(cancelMock).toHaveBeenCalledWith("Removal cancelled");
    expect(patchConfigMock).not.toHaveBeenCalled();

    const unchanged = yaml.parse(readFileSync(configPath, "utf-8"));
    expect(unchanged.sources).toHaveLength(2);
  });
});
