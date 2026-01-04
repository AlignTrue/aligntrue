import { describe, expect, it, afterEach } from "vitest";
import { join } from "node:path";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { Projections, Storage, Trajectories } from "@aligntrue/core";
import { canonicalize } from "../src/identity/canonicalize.js";
import { deterministicId } from "../src/identity/id.js";

type Fixture = {
  trajectory_id: string;
  steps: any[];
  outcomes: any[];
};

function loadFixture(name: string): Fixture {
  const path = join(__dirname, "fixtures", "trajectories", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as Fixture;
}

let tmpDirs: string[] = [];
let stores: Storage.JsonlTrajectoryStore[] = [];

afterEach(async () => {
  for (const store of stores) {
    await store.close();
  }
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
  stores = [];
});

async function buildStoreFromFixture(fix: Fixture) {
  const dir = mkdtempSync(join(tmpdir(), "traj-regress-"));
  tmpDirs.push(dir);
  const store = new Storage.JsonlTrajectoryStore({
    trajectoryPath: join(dir, "traj.jsonl"),
    outcomesPath: join(dir, "outcomes.jsonl"),
    dbPath: join(dir, "traj.db"),
  });
  stores.push(store);

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

function normalizeProjection<T extends { freshness?: { rebuilt_at?: string } }>(
  output: T,
): T {
  if (output && typeof output === "object" && "freshness" in output) {
    const copy: any = {
      ...output,
      freshness: { ...(output as any).freshness },
    };
    if (copy.freshness) {
      copy.freshness.rebuilt_at = "0";
    }
    return copy;
  }
  return output;
}

function hashProjection(output: unknown) {
  return deterministicId(canonicalize(output));
}

describe("trajectory projections regression hashes", () => {
  it("hashes remain stable for golden-simple-task", async () => {
    const fix = loadFixture("golden-simple-task");
    const store = await buildStoreFromFixture(fix);
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

    const observed = {
      cooccurrence: `hash:coo:${hashProjection(normalizeProjection(coo.data))}`,
      transitions: `hash:trn:${hashProjection(normalizeProjection(transitions.data))}`,
      signatures: `hash:sig:${hashProjection(normalizeProjection(signatures.data))}`,
      outcomes: `hash:ocr:${hashProjection(normalizeProjection(outcomes.data))}`,
    };
    // Debug aid for updating expected hashes when fixture changes
    // console.log("regression-hashes", observed);

    const expected = {
      cooccurrence:
        "hash:coo:2e5c37435cc3c1c97642f5cf5a3166d979d6b6c5abccd2c59304bc8ae9080fcd",
      transitions:
        "hash:trn:063e9215338439ff938e12ba860f68a1bd56f4176ed8754acb54fd6ade2fa18b",
      signatures:
        "hash:sig:06c616bd748efc76b1d8e617c088719c60a81e6fc24efffc137beede0eba4b3c",
      outcomes:
        "hash:ocr:42b576af6797c78f8b973bd2bbfa0f507218d122b7a8fb6ce6a8edd97df3df88",
    };

    expect(observed.cooccurrence).toBe(expected.cooccurrence);
    expect(observed.transitions).toBe(expected.transitions);
    expect(observed.signatures).toBe(expected.signatures);
    expect(observed.outcomes).toBe(expected.outcomes);
  });
});

// Helpers: use the projection-specific hashes to avoid brittle JSON compare
