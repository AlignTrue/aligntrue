import { describe, expect, test } from "vitest";
import { mapDbReceipt } from "../db-types";
import type { DbPlanReceipt } from "../db-types";

describe("mapDbReceipt", () => {
  const baseRow: DbPlanReceipt = {
    receipt_id: "r1",
    plan_id: "p1",
    idempotency_key: "ik1",
    mode: "deterministic",
    workspace_id: null,
    occurred_at: "2023-01-01T00:00:00Z",
    ingested_at: "2023-01-01T00:00:00Z",
    provider: "test",
    model: null,
    ai_failed: 0,
    ai_failed_reason: null,
    policy_id: "pol1",
    policy_version: "1",
    policy_hash: "h1",
    policy_stage: "active",
    compiler_version: "1",
    context_hash: "ctx1",
    layout_intent_core_hash: null,
    render_request_hash: "rh1",
    causation_id: null,
    causation_type: null,
    actor_id: "a1",
    actor_type: "user",
  };

  test("maps ai_failed correctly (0 -> false)", () => {
    const result = mapDbReceipt({ ...baseRow, ai_failed: 0 });
    expect(result.ai_failed).toBe(false);
  });

  test("maps ai_failed correctly (1 -> true)", () => {
    const result = mapDbReceipt({ ...baseRow, ai_failed: 1 });
    expect(result.ai_failed).toBe(true);
  });

  test("maps ai_failed correctly (null -> undefined)", () => {
    const result = mapDbReceipt({ ...baseRow, ai_failed: null });
    expect(result.ai_failed).toBeUndefined();
  });

  test("maps optional fields correctly (null -> undefined)", () => {
    const result = mapDbReceipt({
      ...baseRow,
      workspace_id: null,
      model: null,
      ai_failed_reason: null,
      layout_intent_core_hash: null,
      causation_id: null,
      causation_type: null,
    });
    expect(result.workspace_id).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.ai_failed_reason).toBeUndefined();
    expect(result.layout_intent_core_hash).toBeUndefined();
    expect(result.causation_id).toBeUndefined();
    expect(result.causation_type).toBeUndefined();
  });
});
