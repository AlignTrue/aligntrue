import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JsonlTrajectoryStore } from "../src/storage/jsonl-trajectory-store.js";
import { buildTrajectoryEvent } from "../src/trajectories/envelope.js";
import { buildOutcome } from "../src/trajectories/outcome.js";
import type { TrajectoryRefs } from "../src/trajectories/refs.js";

const baseRefs: TrajectoryRefs = {
  entity_refs: [{ ref: "task:1", link: "observed" }],
  artifact_refs: [],
  external_refs: [],
};

let tmpDir: string;
let store: JsonlTrajectoryStore;

afterEach(async () => {
  if (store) {
    await store.close();
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

async function createStore() {
  tmpDir = await mkdtemp(join(tmpdir(), "traj-store-"));
  store = new JsonlTrajectoryStore({
    trajectoryPath: join(tmpDir, "trajectories.jsonl"),
    outcomesPath: join(tmpDir, "outcomes.jsonl"),
    dbPath: join(tmpDir, "traj.db"),
  });
  return store;
}

describe("JsonlTrajectoryStore", () => {
  it("appends and reads trajectory steps in order", async () => {
    const store = await createStore();
    const now = new Date().toISOString();

    const step1 = buildTrajectoryEvent({
      trajectory_id: "t1",
      step_seq: 0,
      prev_step_hash: null,
      step_type: "trajectory_started",
      producer: "host",
      timestamp: now,
      correlation_id: "corr-1",
      refs: baseRefs,
      payload: { trigger: "init" },
    });
    const step2 = buildTrajectoryEvent({
      trajectory_id: "t1",
      step_seq: 1,
      prev_step_hash: step1.step_id,
      step_type: "entity_written",
      producer: "host",
      timestamp: now,
      correlation_id: "corr-1",
      refs: baseRefs,
      payload: { entity_ref: "task:1", command_id: "cmd-1" },
    });

    await store.appendStep(step1);
    await store.appendStep(step2);

    const events = await store.readTrajectory("t1");
    expect(events.map((e) => e.step_seq)).toEqual([0, 1]);
    expect(events[1].prev_step_hash).toBe(step1.step_id);
  });

  it("filters trajectories by entity_ref and step_types, and paginates", async () => {
    const store = await createStore();
    const now = new Date().toISOString();

    for (let i = 0; i < 3; i++) {
      const step = buildTrajectoryEvent({
        trajectory_id: `t${i}`,
        step_seq: 0,
        prev_step_hash: null,
        step_type: i === 0 ? "entity_read" : "entity_written",
        producer: "host",
        timestamp: now,
        correlation_id: `corr-${i}`,
        refs: baseRefs,
        payload:
          i === 0
            ? { entity_ref: "task:1", fields: [] }
            : { entity_ref: "task:1", command_id: `cmd-${i}` },
      });
      await store.appendStep(step);
    }

    const page1 = await store.listTrajectories({
      filters: { entity_ref: "task:1", step_types: ["entity_written"] },
      limit: 1,
      sort: "time_desc",
    });
    expect(page1.ids.length).toBe(1);
    expect(page1.next_cursor).toBeDefined();

    const page2 = await store.listTrajectories({
      filters: { entity_ref: "task:1", step_types: ["entity_written"] },
      limit: 1,
      sort: "time_desc",
      cursor: page1.next_cursor,
    });
    expect(page2.ids.length).toBe(1);
    expect(page2.ids[0]).not.toBe(page1.ids[0]);
  });

  it("appends and lists outcomes", async () => {
    const store = await createStore();
    const now = new Date().toISOString();

    const outcome = buildOutcome({
      outcome_id: "o1",
      attaches_to: { trajectory_id: "t-out" },
      kind: "success",
      severity: 1,
      metrics: { duration_ms: 5 },
      refs: baseRefs,
      timestamp: now,
    });
    await store.appendOutcome(outcome);

    const result = await store.listOutcomes({
      filters: { command_id: undefined },
      limit: 10,
      sort: "time_desc",
    });
    expect(result.outcomes.length).toBe(1);
    expect(result.outcomes[0].outcome_id).toBe("o1");
  });
});
