/**
 * Allow list enforcement tests
 * Tests strict enforcement of approved bundle hashes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import { team } from "../../src/commands/team.js";
import { sync } from "../../src/commands/sync.js";
import * as clack from "@clack/prompts";
import { stringify as stringifyYaml } from "yaml";

vi.mock("@clack/prompts");

describe("Allow List Enforcement", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testDir = join(tmpdir(), `allow-list-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Mock process.exit to throw for testing
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock clack prompts
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
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // TODO: This test is complex because sync regenerates the lockfile before validation
  // The real-world scenario (team member modifies rules) is tested in team-workflow.test.ts
  it.skip("blocks sync with unapproved bundle hash", async () => {
    // Init team mode
    await init(["--yes"]);
    await team(["enable", "--yes"]);

    // First sync to generate lockfile
    await sync(["--yes"]);

    // Create allow list with different hash (simulating approved old version)
    const lockfile = JSON.parse(readFileSync(".aligntrue.lock.json", "utf-8"));
    const allowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:oldhashvalue123" }], // Wrong hash
    };
    writeFileSync(".aligntrue/allow.yaml", stringifyYaml(allowList), "utf-8");

    // Modify lockfile to have different hash (simulating drift)
    lockfile.bundle_hash = "newhashvalue456";
    writeFileSync(
      ".aligntrue.lock.json",
      JSON.stringify(lockfile, null, 2),
      "utf-8",
    );

    // Sync should fail because lockfile hash not in allow list
    await expect(sync(["--yes"])).rejects.toThrow("process.exit(1)");
  });

  it("allows sync with --force flag", async () => {
    // Same setup as above
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);

    const allowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:wronghash" }],
    };
    writeFileSync(".aligntrue/allow.yaml", stringifyYaml(allowList), "utf-8");

    // Sync with --force should work
    await sync(["--force", "--yes"]);
  });

  it("approves current bundle with --current flag", async () => {
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);

    const lockfile = JSON.parse(readFileSync(".aligntrue.lock.json", "utf-8"));

    await team(["approve", "--current"]);

    const allowListContent = readFileSync(".aligntrue/allow.yaml", "utf-8");
    expect(allowListContent).toContain(lockfile.bundle_hash);
  });

  it("allows sync when bundle hash is approved", async () => {
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);

    // Approve current bundle
    await team(["approve", "--current"]);

    // Sync should work with approved bundle
    await sync(["--yes"]);
  });

  it("shows helpful error message when bundle not approved", async () => {
    await init(["--yes"]);
    await team(["enable", "--yes"]);
    await sync(["--yes"]);

    // Create allow list with different hash
    const allowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:differenthash" }],
    };
    writeFileSync(".aligntrue/allow.yaml", stringifyYaml(allowList), "utf-8");

    // Capture console.error output
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await sync(["--yes"]);
    } catch {
      // Expected to throw
    }

    // Verify helpful error message was shown
    const errorCalls = errorSpy.mock.calls.map((call) => call[0]);
    expect(
      errorCalls.some((msg) => msg.includes("Bundle hash not in allow list")),
    ).toBe(true);
    expect(
      errorCalls.some((msg) =>
        msg.includes("aligntrue team approve --current"),
      ),
    ).toBe(true);

    errorSpy.mockRestore();
  });
});
