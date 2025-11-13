/**
 * Comprehensive team mode workflow tests
 * Simulates two team members collaborating
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import { team } from "../../src/commands/team.js";
import * as clack from "@clack/prompts";
import { parse as parseYaml } from "yaml";

vi.mock("@clack/prompts");

describe("Team Mode Workflow", () => {
  let env1: string;
  let env2: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    env1 = join(tmpdir(), `team-env1-${Date.now()}`);
    env2 = join(tmpdir(), `team-env2-${Date.now()}`);
    mkdirSync(env1, { recursive: true });
    mkdirSync(env2, { recursive: true });

    // Mock process.exit to throw for testing
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock clack prompts to avoid terminal interaction
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as any);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(env1)) {
      rmSync(env1, { recursive: true, force: true });
    }
    if (existsSync(env2)) {
      rmSync(env2, { recursive: true, force: true });
    }
  });

  it("team mode defaults to soft lockfile validation", async () => {
    process.chdir(env1);
    await init(["--yes"]);
    await team(["enable", "--yes"]);

    // Check config has soft lockfile mode
    const config = parseYaml(
      readFileSync(join(env1, ".aligntrue/config.yaml"), "utf-8"),
    );
    expect(config.lockfile.mode).toBe("soft");
  });
});
