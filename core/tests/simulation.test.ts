import { describe, expect, it } from "vitest";

import { Simulation, type Projections as ProjNS } from "@aligntrue/core";
import { FEATURE_SCHEMA_V1 } from "../src/simulation/types.js";

function makeCooccurrence(): ProjNS.CooccurrenceState {
  const state: ProjNS.CooccurrenceState = {
    edges: new Map(),
    entity_trajectories: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
  };
  const neighbors = new Map<string, ProjNS.CooccurrenceEdge>();
  neighbors.set("entity:B", {
    weight: 2,
    trajectory_ids: ["t1", "t2"],
    last_seen: new Date().toISOString(),
  });
  state.edges.set("entity:A", neighbors);
  state.entity_trajectories.set("entity:B", ["t1", "t2"]);
  return state;
}

function makeOutcomeCorrelations(): ProjNS.OutcomeCorrelationState {
  const state: ProjNS.OutcomeCorrelationState = {
    entity_outcomes: new Map(),
    entity_totals: new Map(),
    pattern_outcomes: new Map(),
    pattern_totals: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
  };
  state.entity_totals.set("entity:B", 2);
  state.entity_outcomes.set(
    "entity:B",
    new Map([
      ["incident", 1],
      ["success", 1],
    ]),
  );
  return state;
}

function makeSignatures(): ProjNS.SignatureState {
  const state: ProjNS.SignatureState = {
    adjacency: new Map(),
    node_labels: new Map(),
    entity_signatures: new Map(),
    signature_index: new Map(),
    entity_outcomes: new Map(),
    trajectory_step_counts: new Map(),
    trajectory_outcomes: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
  };
  state.entity_signatures.set("entity:B", "sig-1");
  state.signature_index.set("sig-1", ["entity:B"]);
  return state;
}

function makeTransitions(): ProjNS.TransitionState {
  const state: ProjNS.TransitionState = {
    step_ngrams: new Map(),
    outcome_conditioned: new Map(),
    entity_type_patterns: new Map(),
    trajectory_outcomes: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
    _temp_trajectory_steps: new Map(),
    _temp_trajectory_refs: new Map(),
  };
  state.outcome_conditioned.set(
    "entity_written->trajectory_ended",
    new Map([["success", 3]]),
  );
  return state;
}

describe("Simulation API", () => {
  it("blast radius returns affected entities with evidence", () => {
    const res = Simulation.blastRadius(
      makeCooccurrence(),
      makeOutcomeCorrelations(),
      { entity_ref: "entity:A" },
    );
    expect(res.affected_entities.length).toBe(1);
    expect(res.evidence.length).toBe(1);
    expect(res.affected_entities[0].entity_ref).toBe("entity:B");
  });

  it("similar trajectories returns signature matches", () => {
    const res = Simulation.similarTrajectories(
      makeSignatures(),
      makeCooccurrence(),
      {
        entity_refs: ["entity:B"],
      },
    );
    expect(res.trajectories.length).toBeGreaterThan(0);
    expect(res.trajectories[0].trajectory_id).toBe("t1");
  });

  it("similar trajectories returns normalized similarity score", () => {
    const sigState = makeSignatures();
    const coState = makeCooccurrence();

    // Add another entity with same signature to same trajectory
    sigState.entity_signatures.set("entity:C", "sig-1");
    sigState.signature_index.set("sig-1", ["entity:B", "entity:C"]);
    coState.entity_trajectories.set("entity:C", ["t1"]);

    const res = Simulation.similarTrajectories(sigState, coState, {
      entity_refs: ["entity:B"],
    });

    expect(res.trajectories.length).toBeGreaterThan(0);
    expect(res.trajectories[0].similarity_score).toBe(1.0); // 1/1 target signatures matched
  });

  it("similar trajectories handles multiple target entities", () => {
    const sigState = makeSignatures();
    const coState = makeCooccurrence();

    // Add another target entity with different signature
    sigState.entity_signatures.set("entity:D", "sig-2");
    sigState.signature_index.set("sig-2", ["entity:D"]);
    coState.entity_trajectories.set("entity:D", ["t1"]);

    const res = Simulation.similarTrajectories(sigState, coState, {
      entity_refs: ["entity:B", "entity:D"],
    });

    expect(res.trajectories[0].similarity_score).toBe(1.0); // 2/2 target signatures matched

    // Trajectory only matching one sig
    coState.entity_trajectories.set("entity:E", ["t2"]);
    sigState.entity_signatures.set("entity:E", "sig-1");
    // sig-1 matches entity:B

    const res2 = Simulation.similarTrajectories(sigState, coState, {
      entity_refs: ["entity:B", "entity:D"],
    });
    const t2 = res2.trajectories.find((t) => t.trajectory_id === "t2");
    expect(t2?.similarity_score).toBe(0.5); // 1/2 target signatures matched
  });

  it("simulateChange combines pattern and entity outcomes", () => {
    const res = Simulation.simulateChange(
      makeTransitions(),
      makeOutcomeCorrelations(),
      {
        affected_entities: ["entity:B"],
        step_pattern: ["entity_written", "trajectory_ended"],
      },
    );
    expect(res.predicted_outcomes.length).toBeGreaterThan(0);
    expect(res.risk_factors.length).toBeGreaterThan(0);
  });

  it("determinism: same inputs yield same hashes", () => {
    const co = makeCooccurrence();
    const oc = makeOutcomeCorrelations();
    const sig = makeSignatures();
    const tr = makeTransitions();
    const engine = Simulation.createSimulationEngine({
      cooccurrence: co,
      transitions: tr,
      signatures: sig,
      outcomeCorrelations: oc,
    });

    const r1 = engine.blastRadius({ entity_ref: "entity:A" });
    const r2 = engine.blastRadius({ entity_ref: "entity:A" });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("handles empty state gracefully", () => {
    const res = Simulation.blastRadius(
      {
        edges: new Map(),
        entity_trajectories: new Map(),
        freshness: {
          last_trajectory_id: null,
          last_step_id: null,
          last_outcome_id: null,
          rebuilt_at: new Date().toISOString(),
        },
      },
      makeOutcomeCorrelations(),
      { entity_ref: "entity:missing" },
    );
    expect(res.affected_entities.length).toBe(0);
    expect(res.confidence).toBe(0);
  });

  it("includes algorithm and feature schema versions", () => {
    const res = Simulation.blastRadius(
      makeCooccurrence(),
      makeOutcomeCorrelations(),
      {
        entity_ref: "entity:A",
      },
    );
    expect(res.algorithm_version).toBe("v1.0.0");
    expect(res.feature_schema_version).toBe("v1");
  });

  it("feature schema v1 matches documented set", () => {
    expect(FEATURE_SCHEMA_V1).toEqual([
      "entity_type_match",
      "cooccurrence_weight",
      "transition_ngram_match",
      "structural_signature_similarity",
      "outcome_correlation_prior",
      "recency_decay",
    ]);
  });
});
