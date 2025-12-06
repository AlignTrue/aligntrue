import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

const ORIGINAL_CWD = process.cwd();
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

let TEST_DIR: string;

describeSkipWindows("Init Ruler mode precedence", () => {
  beforeEach(async () => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-init-ruler-"));
    process.chdir(TEST_DIR);
    vi.resetModules();
  });

  afterEach(async () => {
    await cleanupDir(TEST_DIR);
    vi.resetModules();
    vi.clearAllMocks();
    process.chdir(ORIGINAL_CWD);
  });

  it("keeps CLI-provided mode when ruler config has a mode", async () => {
    vi.doMock("../../src/commands/init/ruler-detector.js", () => ({
      detectRulerProject: () => true,
      promptRulerMigration: async () => ({ mode: "team" }),
    }));

    const { init } = await import("../../src/commands/init.js");

    await init(["--yes", "--mode", "solo"]);

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = yaml.parse(configContent);

    expect(config.mode).toBe("solo");
  });
});
