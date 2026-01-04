import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Storage } from "@aligntrue/core";

import { createTrajectoryContext } from "../src/trajectory-context.js";

let tmpDir: string;
let store: Storage.TrajectoryStore;

afterEach(async () => {
  if (store) {
    await store.close();
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

async function makeStore() {
  tmpDir = await mkdtemp(join(tmpdir(), "traj-ctx-"));
  store = new Storage.JsonlTrajectoryStore({
    trajectoryPath: join(tmpDir, "traj.jsonl"),
    outcomesPath: join(tmpDir, "outcomes.jsonl"),
    dbPath: join(tmpDir, "traj.db"),
  });
  return store;
}

describe("trajectory-context", () => {
  it("emits start and chained steps with deterministic ids", async () => {
    const s = await makeStore();
    const ctx = createTrajectoryContext({
      store: s,
      correlation_id: "corr-1",
      trajectory_id: "t-1",
    });

    const start = await ctx.start("test");
    const write = await ctx.emitStep(
      "entity_written",
      { entity_ref: "task:1", command_id: "cmd-1" },
      { entity_refs: [], artifact_refs: [], external_refs: [] },
    );

    expect(start.step_seq).toBe(0);
    expect(write.step_seq).toBe(1);

    const steps = await store.readTrajectory("t-1");
    expect(steps).toHaveLength(2);
    expect(steps[1].prev_step_hash).toBe(steps[0].step_id);
  });

  it("enforces step budget", async () => {
    const store = await makeStore();
    const ctx = createTrajectoryContext({
      store,
      correlation_id: "corr-2",
      budgets: { steps_remaining: 1 },
    });

    await ctx.start("only-one");
    await expect(
      ctx.emitStep(
        "entity_read",
        { entity_ref: "task:1", fields: [] },
        { entity_refs: [], artifact_refs: [], external_refs: [] },
      ),
    ).rejects.toThrow(/step budget/i);
  });

  it("applies volume sampling when configured", async () => {
    const store = await makeStore();
    const ctx = createTrajectoryContext({
      store,
      correlation_id: "corr-3",
      volume: { entity_read: "sample", sample_rate: 0 },
    });

    await ctx.start("sample");
    await ctx.emitStep(
      "entity_read",
      { entity_ref: "task:1", fields: [] },
      { entity_refs: [], artifact_refs: [], external_refs: [] },
    );
    const steps = await store.readTrajectory(ctx.trajectory_id);
    // Only the start step should be recorded because sample_rate=0 drops entity_read
    expect(steps).toHaveLength(1);
  });
});
