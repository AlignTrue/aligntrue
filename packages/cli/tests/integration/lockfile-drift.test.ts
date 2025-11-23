import { join } from "path";
import { writeFileSync, readFileSync, utimesSync, statSync } from "fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Correct import path for test helpers
import {
  runCli,
  createTestDir,
  cleanupTestDir,
} from "../utils/integration-helpers.js";

// Skip on Windows due to file timestamp precision issues
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Lockfile Drift", () => {
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

    // Initial sync to generate lockfile
    await runCli(["sync", "--yes"], { cwd: testDir });

    // Wait to ensure file modification time is strictly greater than last sync time
    await new Promise((r) => setTimeout(r, 2000));

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

    // Ensure file modification time is strictly greater than last sync time
    // This prevents test flakiness due to filesystem timestamp resolution
    const lastSyncPath = join(testDir, ".aligntrue", ".last-sync");
    const lastSync = parseInt(readFileSync(lastSyncPath, "utf-8"), 10);
    const stats = statSync(agentsPath);

    if (stats.mtimeMs <= lastSync) {
      const newTime = new Date(lastSync + 2000);
      utimesSync(agentsPath, newTime, newTime);
    }

    // 4. Verify drift detected (agent file modified)
    // Note: drift command checks agent file vs IR drift in team mode
    const driftResult2 = await runCli(["drift", "--gates"], { cwd: testDir });
    if (driftResult2.exitCode !== 2) {
      console.log(
        "Drift failed to detect changes. Stdout:",
        driftResult2.stdout,
      );
      console.log("Stderr:", driftResult2.stderr);
    }
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
