import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  Projections,
  Simulation,
  Storage,
  Trajectories,
} from "@aligntrue/core";

type Fixture = {
  trajectory_id: string;
  steps: any[];
  outcomes: any[];
};

function loadFixture(name: string): Fixture {
  const path = join(__dirname, "fixtures", "trajectories", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as Fixture;
}

async function buildStoreFromFixture(fix: Fixture) {
  const dir = mkdtempSync(join(tmpdir(), "traj-fixture-"));
  const store = new Storage.JsonlTrajectoryStore({
    trajectoryPath: join(dir, "traj.jsonl"),
    outcomesPath: join(dir, "outcomes.jsonl"),
    dbPath: join(dir, "traj.db"),
  });

  for (const step of fix.steps) {
    const evt = Trajectories.buildTrajectoryEvent({
      ...step,
      causation: step.causation ?? {},
    });
    await store.appendStep(evt);
  }
  for (const outcome of fix.outcomes) {
    const out = Trajectories.buildOutcome(outcome);
    await store.appendOutcome(out);
  }
  return store;
}

async function rebuildAll(store: Storage.JsonlTrajectoryStore) {
  const coo = await Projections.rebuildTrajectoryProjection(
    Projections.CooccurrenceProjectionDef,
    store,
  );
  const transitions = await Projections.rebuildTrajectoryProjection(
    Projections.TransitionProjectionDef,
    store,
  );
  const signatures = await Projections.rebuildTrajectoryProjection(
    Projections.SignatureProjectionDef,
    store,
  );
  const outcomes = await Projections.rebuildTrajectoryProjection(
    Projections.OutcomeCorrelationProjectionDef,
    store,
  );
  const engine = Simulation.createSimulationEngine({
    cooccurrence: coo.data,
    transitions: transitions.data,
    signatures: signatures.data,
    outcomeCorrelations: outcomes.data,
  });
  return { coo, transitions, signatures, outcomes, engine };
}

describe("simulation calibration (golden fixtures)", () => {
  it("simple task fixture yields success and confidence > 0", async () => {
    const fix = loadFixture("golden-simple-task");
    const store = await buildStoreFromFixture(fix);
    const { engine } = await rebuildAll(store);
    const res = await engine.simulateChange({
      affected_entities: ["task:1"],
      step_pattern: ["entity_written", "trajectory_ended"],
    });
    expect(
      res.predicted_outcomes.find((p) => p.outcome === "success"),
    ).toBeTruthy();
    expect(res.confidence).toBeGreaterThan(0);
  });

  it("revert scenario fixture produces rollback evidence", async () => {
    const fix = loadFixture("golden-revert-scenario");
    const store = await buildStoreFromFixture(fix);
    const { engine } = await rebuildAll(store);
    const res = await engine.blastRadius({
      entity_ref: "service:billing",
      include_outcomes: ["rollback"],
    });
    const rollback = res.predicted_outcomes.find(
      (p) => p.outcome === "rollback",
    );
    expect(rollback).toBeTruthy();
    expect(res.evidence.length).toBeGreaterThan(0);
  });

  it("multi-entity fixture yields co-occurrence", async () => {
    const fix = loadFixture("golden-multi-entity");
    const store = await buildStoreFromFixture(fix);
    const { engine } = await rebuildAll(store);
    const res = await engine.blastRadius({ entity_ref: "service:payments" });
    const related = res.affected_entities.find(
      (a) => a.entity_ref === "service:orders",
    );
    expect(related).toBeTruthy();
  });
});
