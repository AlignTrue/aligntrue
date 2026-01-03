import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Storage, Trajectories, Projections } from "@aligntrue/core";

const baseRefs = {
  entity_refs: [{ ref: "entity:1", link: "observed" }],
  artifact_refs: [],
  external_refs: [],
};

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), "traj-proj-"));
  const store = new Storage.JsonlTrajectoryStore({
    trajectoryPath: join(dir, "traj.jsonl"),
    outcomesPath: join(dir, "outcomes.jsonl"),
    dbPath: join(dir, "traj.db"),
  });
  return { dir, store };
}

function makeStep(trajectory_id: string, seq: number) {
  return Trajectories.buildTrajectoryEvent({
    trajectory_id,
    step_seq: seq,
    prev_step_hash: seq === 0 ? null : `hash-${seq - 1}`,
    step_type: seq === 0 ? "trajectory_started" : "entity_written",
    producer: "host",
    timestamp: new Date().toISOString(),
    correlation_id: "corr-1",
    refs: baseRefs,
    payload:
      seq === 0
        ? { trigger: "init" }
        : { entity_ref: "entity:1", command_id: `cmd-${seq}` },
  });
}

describe("trajectory projections", () => {
  it("rebuilds deterministically for cooccurrence + transitions + signatures + outcome correlations", async () => {
    const { dir, store } = await makeStore();
    const steps = [makeStep("t1", 0), makeStep("t1", 1), makeStep("t2", 0)];
    for (const s of steps) {
      await store.appendStep(s);
    }
    await store.appendOutcome(
      Trajectories.buildOutcome({
        outcome_id: "o1",
        attaches_to: { trajectory_id: "t1" },
        kind: "success",
        severity: 1,
        metrics: {},
        refs: baseRefs,
        timestamp: new Date().toISOString(),
      }),
    );

    const defs = [
      Projections.CooccurrenceProjectionDef,
      Projections.TransitionProjectionDef,
      Projections.SignatureProjectionDef,
      Projections.OutcomeCorrelationProjectionDef,
    ];

    const firstHashes: string[] = [];
    const secondHashes: string[] = [];

    for (const def of defs) {
      const rebuilt = await Projections.rebuildTrajectoryProjection(
        def as any,
        store,
      );
      firstHashes.push(rebuilt.hash);
      // rebuild again to confirm determinism
      const rebuilt2 = await Projections.rebuildTrajectoryProjection(
        def as any,
        store,
      );
      secondHashes.push(rebuilt2.hash);
    }

    expect(firstHashes).toEqual(secondHashes);

    await rm(dir, { recursive: true, force: true });
  });

  it("cooccurrence prunes by time window", async () => {
    const { dir, store } = await makeStore();
    const tsOld = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const tsNew = new Date().toISOString();
    const oldStep = Trajectories.buildTrajectoryEvent({
      trajectory_id: "t-old",
      step_seq: 0,
      prev_step_hash: null,
      step_type: "trajectory_started",
      producer: "host",
      timestamp: tsOld,
      correlation_id: "corr-old",
      refs: {
        entity_refs: [
          { ref: "entity:A", link: "observed" },
          { ref: "entity:B", link: "observed" },
        ],
        artifact_refs: [],
        external_refs: [],
      },
      payload: { trigger: "old" },
    });
    const newStep = Trajectories.buildTrajectoryEvent({
      trajectory_id: "t-new",
      step_seq: 0,
      prev_step_hash: null,
      step_type: "trajectory_started",
      producer: "host",
      timestamp: tsNew,
      correlation_id: "corr-new",
      refs: {
        entity_refs: [
          { ref: "entity:C", link: "observed" },
          { ref: "entity:D", link: "observed" },
        ],
        artifact_refs: [],
        external_refs: [],
      },
      payload: { trigger: "new" },
    });
    await store.appendStep(oldStep);
    await store.appendStep(newStep);

    const rebuilt = await Projections.rebuildTrajectoryProjection(
      Projections.CooccurrenceProjectionDef as any,
      store,
    );
    const hashBefore = Projections.cooccurrenceHash(rebuilt.data as any);
    const pruned = Projections.pruneCooccurrence(
      rebuilt.data as any,
      30, // window days
    );
    const hashAfter = Projections.cooccurrenceHash(pruned);
    expect(hashBefore).not.toBe(hashAfter);

    await rm(dir, { recursive: true, force: true });
  });
});
