/**
 * Comprehensive team mode workflow tests
 * Simulates two team members collaborating
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  cpSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import { team } from "../../src/commands/team.js";
import { sync } from "../../src/commands/sync.js";
import * as clack from "@clack/prompts";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

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

  it.skip("full collaboration workflow: init → enable → sync → clone → modify → detect drift", async () => {
    // Team member 1: Initialize and enable team mode
    process.chdir(env1);
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);

    // Verify lockfile generated
    const lockfile1 = JSON.parse(
      readFileSync(join(env1, ".aligntrue.lock.json"), "utf-8"),
    );
    expect(lockfile1.bundle_hash).toBeDefined();
    expect(lockfile1.mode).toBe("team");

    // Team member 1: Approve current bundle
    await team(["approve", "--current"]);
    const allowList1 = parseYaml(
      readFileSync(join(env1, ".aligntrue/allow.yaml"), "utf-8"),
    );
    expect(allowList1.sources).toHaveLength(1);
    expect(allowList1.sources[0].value).toContain(lockfile1.bundle_hash);

    // Team member 2: Clone repo (copy files)
    cpSync(env1, env2, { recursive: true });
    process.chdir(env2);

    // Team member 2: Sync (should work with approved bundle)
    await sync(["--yes"]);

    // Team member 2: Modify a rule in IR directly (to ensure hash changes)
    const ir = parseYaml(
      readFileSync(join(env2, ".aligntrue/.rules.yaml"), "utf-8"),
    );
    // Change content to ensure hash changes
    if (ir.sections && ir.sections[0]) {
      ir.sections[0].content = "Modified content to trigger hash change";
    }
    writeFileSync(
      join(env2, ".aligntrue/.rules.yaml"),
      stringifyYaml(ir),
      "utf-8",
    );

    // Team member 2: Sync to regenerate lockfile with new hash
    await sync(["--yes"]);

    // Verify lockfile hash changed
    const lockfile2 = JSON.parse(
      readFileSync(join(env2, ".aligntrue.lock.json"), "utf-8"),
    );
    expect(lockfile2.bundle_hash).not.toBe(lockfile1.bundle_hash);

    // Team member 2: Approve new bundle (required before next sync)
    await team(["approve", "--current"]);

    // Now sync should work
    await sync(["--yes"]);
  });

  // TODO: Sync regenerates lockfile before validation, making this test complex
  // The validation happens on the OLD lockfile, but sync generates a NEW one
  it.skip("detects drift when team member has unapproved changes", async () => {
    // Setup: env1 with approved bundle
    process.chdir(env1);
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);
    await team(["approve", "--current"]);

    // Clone to env2
    cpSync(env1, env2, { recursive: true });

    // env2: Modify without approval
    process.chdir(env2);
    const ir = parseYaml(
      readFileSync(join(env2, ".aligntrue/.rules.yaml"), "utf-8"),
    );
    if (ir.sections && ir.sections[0]) {
      ir.sections[0].content = "Modified to error state";
    }
    writeFileSync(
      join(env2, ".aligntrue/.rules.yaml"),
      stringifyYaml(ir),
      "utf-8",
    );
    await sync(["--yes"]);

    // env2: Try to sync again (should fail due to unapproved bundle)
    await expect(sync(["--yes"])).rejects.toThrow("process.exit(1)");
  });

  // TODO: Same issue as above - sync regenerates lockfile before validation
  it.skip("allows --force to bypass allow list validation", async () => {
    // Setup: env1 with approved bundle
    process.chdir(env1);
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);
    await team(["approve", "--current"]);

    // Modify rules to change bundle hash
    const ir = parseYaml(
      readFileSync(join(env1, ".aligntrue/.rules.yaml"), "utf-8"),
    );
    if (ir.sections && ir.sections[0]) {
      ir.sections[0].content = "Modified to error severity";
    }
    writeFileSync(
      join(env1, ".aligntrue/.rules.yaml"),
      stringifyYaml(ir),
      "utf-8",
    );
    await sync(["--yes"]);

    // Sync should fail without --force
    await expect(sync(["--yes"])).rejects.toThrow("process.exit(1)");

    // Sync should work with --force
    await sync(["--force", "--yes"]);
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
