import { describe, expect, it } from "vitest";

import {
  computeStepId,
  buildTrajectoryEvent,
  validateTrajectoryEvent,
} from "../src/trajectories/envelope.js";
import {
  validateOutcome,
  buildOutcome,
  type OutcomeRecorded,
} from "../src/trajectories/outcome.js";
import {
  validateRefs,
  hashRefs,
  type TrajectoryRefs,
} from "../src/trajectories/refs.js";
import {
  isBaseStep,
  isOverlayStep,
  type TrajectoryStepPayloadByType,
} from "../src/trajectories/steps.js";

const baseRefs: TrajectoryRefs = {
  entity_refs: [{ ref: "task:123", link: "observed" }],
  artifact_refs: [],
  external_refs: [],
};

describe("trajectory envelope", () => {
  it("computes deterministic step_id", () => {
    const input = {
      trajectory_id: "t1",
      step_seq: 1,
      prev_step_hash: null,
      payload: {
        trigger: "test",
      } satisfies TrajectoryStepPayloadByType["trajectory_started"],
      step_type: "trajectory_started" as const,
    };
    const a = computeStepId(input);
    const b = computeStepId(input);
    expect(a).toBe(b);
  });

  it("changes step_id when prev_step_hash changes (hash chain)", () => {
    const common = {
      trajectory_id: "t1",
      step_seq: 2,
      payload: {
        outcome_summary: "done",
      } satisfies TrajectoryStepPayloadByType["trajectory_ended"],
      step_type: "trajectory_ended" as const,
    };
    const withPrevA = computeStepId({ ...common, prev_step_hash: "hash-a" });
    const withPrevB = computeStepId({ ...common, prev_step_hash: "hash-b" });
    expect(withPrevA).not.toBe(withPrevB);
  });

  it("validates required fields", () => {
    expect(() =>
      validateTrajectoryEvent({
        schema_version: 1,
        // missing trajectory_id should throw
      } as unknown as OutcomeRecorded),
    ).toThrow();
  });

  it("buildTrajectoryEvent applies schema version and validation", () => {
    const evt = buildTrajectoryEvent({
      trajectory_id: "t1",
      step_seq: 0,
      prev_step_hash: null,
      step_type: "trajectory_started",
      producer: "host",
      timestamp: new Date().toISOString(),
      correlation_id: "corr-1",
      refs: baseRefs,
      payload: { trigger: "init" },
    });
    expect(evt.schema_version).toBe(1);
    expect(evt.step_id).toBeTruthy();
  });
});

describe("refs", () => {
  it("validates provenance and hashes deterministically", () => {
    const refs: TrajectoryRefs = {
      entity_refs: [{ ref: "task:1", link: "observed", confidence: 0.9 }],
      artifact_refs: [],
      external_refs: [],
    };
    validateRefs(refs);
    const h1 = hashRefs(refs);
    const h2 = hashRefs(refs);
    expect(h1).toBe(h2);
  });

  it("rejects invalid confidence", () => {
    const refs: TrajectoryRefs = {
      entity_refs: [{ ref: "task:1", link: "observed", confidence: 2 }],
      artifact_refs: [],
      external_refs: [],
    };
    expect(() => validateRefs(refs)).toThrow();
  });
});

describe("outcome", () => {
  it("buildOutcome sets schema version", () => {
    const outcome = buildOutcome({
      outcome_id: "o1",
      attaches_to: { trajectory_id: "t1" },
      kind: "success",
      severity: 1,
      metrics: { duration_ms: 10 },
      refs: baseRefs,
      timestamp: new Date().toISOString(),
    });
    expect(outcome.schema_version).toBe(1);
  });

  it("rejects missing attachment", () => {
    expect(() =>
      validateOutcome({
        outcome_id: "o2",
        attaches_to: {},
        kind: "success",
        severity: 0,
        metrics: {},
        refs: baseRefs,
        timestamp: new Date().toISOString(),
        schema_version: 1,
      }),
    ).toThrow();
  });
});

describe("step taxonomy helpers", () => {
  it("identifies base vs overlay steps", () => {
    expect(isBaseStep("entity_written")).toBe(true);
    expect(isOverlayStep("decision_rationale")).toBe(true);
  });
});

describe("producer enforcement", () => {
  it("rejects base step with non-host producer", () => {
    expect(() =>
      buildTrajectoryEvent({
        trajectory_id: "t1",
        step_seq: 0,
        prev_step_hash: null,
        step_type: "entity_written",
        producer: "pack",
        timestamp: new Date().toISOString(),
        correlation_id: "c1",
        refs: baseRefs,
        payload: { entity_ref: "task:1", command_id: "cmd-1" },
      }),
    ).toThrow(/Base step "entity_written" requires producer "host"/);
  });

  it("rejects overlay step with host producer", () => {
    expect(() =>
      buildTrajectoryEvent({
        trajectory_id: "t1",
        step_seq: 0,
        prev_step_hash: null,
        step_type: "hypothesis",
        producer: "host",
        timestamp: new Date().toISOString(),
        correlation_id: "c1",
        refs: baseRefs,
        payload: { statement: "maybe", confidence: 0.5, grounding: [] },
      }),
    ).toThrow(/Overlay step "hypothesis" cannot have producer "host"/);
  });
});
