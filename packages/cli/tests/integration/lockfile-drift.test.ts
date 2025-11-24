import { join } from "path";
import { writeFileSync, readFileSync } from "fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Correct import path for test helpers
import {
  runCli,
  createTestDir,
  cleanupTestDir,
} from "../utils/integration-helpers.js";

describe("Lockfile Drift", () => {
  let testDir: string;

  beforeAll(async () => {
    // Ensure clean state from previous tests
    await new Promise((resolve) => setTimeout(resolve, 200));
    testDir = await createTestDir("lockfile-drift-test");
  });

  afterAll(async () => {
    await cleanupTestDir(testDir);
  });

  it("should not report drift after legitimate sync operations", async () => {
    // 1. Initialize in team mode
    await runCli(["init", "--yes", "--mode", "team"], { cwd: testDir });

    // Initial sync to generate lockfile and store hashes
    // Note: Use --force to ensure hashes are computed even if nothing appears to have changed
    const syncResult1 = await runCli(["sync", "--yes", "--force"], {
      cwd: testDir,
    });
    if (syncResult1.exitCode !== 0) {
      console.log(
        "Initial sync failed:",
        syncResult1.stdout,
        syncResult1.stderr,
      );
    }
    expect(syncResult1.exitCode).toBe(0);

    // 2. Verify no drift initially
    const driftResult1 = await runCli(["drift", "--gates"], { cwd: testDir });
    expect(driftResult1.exitCode).toBe(0);

    // 3. Make a change to an agent file
    const agentsPath = join(testDir, "AGENTS.md");
    const agentsContent = readFileSync(agentsPath, "utf-8");
    writeFileSync(
      agentsPath,
      agentsContent + "\n\n## New Rule\n\nApproved change.\n",
      "utf-8",
    );

    // 4. Verify drift detected (agent file modified)
    // Note: drift command checks agent file vs stored hash in team mode
    const driftResult2 = await runCli(["drift", "--gates"], { cwd: testDir });
    expect(driftResult2.exitCode).toBe(2); // Exit code 2 means drift detected with --gates

    // 5. Sync changes back (approval)
    const syncResult = await runCli(
      ["sync", "--accept-agent", "agents", "--yes"],
      { cwd: testDir },
    );
    expect(syncResult.exitCode).toBe(0);

    // 6. Verify no drift after sync
    // This fails if lockfile wasn't updated during syncFromAgent
    const driftResult3 = await runCli(["drift", "--gates"], { cwd: testDir });
    if (driftResult3.exitCode !== 0) {
      console.log("Drift output:", driftResult3.stdout);
    }
    expect(driftResult3.exitCode).toBe(0);
  });
});
