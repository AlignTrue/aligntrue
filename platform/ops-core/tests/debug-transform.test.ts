import { describe, expect, it } from "vitest";

describe("debug transform", () => {
  it.skip("shows transformed code via __vite_ssr_import__", async () => {
    // This test will show what vitest actually transforms

    // Let's just check if the validation works by catching the error
    const { Envelopes } = await import("../src/index.js");

    const actor = {
      actor_id: "actor-1",
      actor_type: "human" as const,
      display_name: "Test User",
    };

    const commandWithoutIdempotencyKey = {
      command_id: "c1",
      command_type: "do",
      payload: { ok: true },
      target_ref: "target-1",
      dedupe_scope: "tenant-1",
      correlation_id: "corr-1",
      actor,
      requested_at: "2024-01-01T00:00:00Z",
    };

    const commandWithIdempotencyKey = {
      ...commandWithoutIdempotencyKey,
      idempotency_key: "idem-1",
    };

    // Test 1: without idempotency_key should throw
    let threwWithout = false;
    try {
      Envelopes.validateCommandEnvelope(commandWithoutIdempotencyKey as any);
    } catch (e: any) {
      threwWithout = true;
      console.log("Without idempotency_key - threw:", e.message);
    }

    // Test 2: with idempotency_key should pass
    let threwWith = false;
    try {
      Envelopes.validateCommandEnvelope(commandWithIdempotencyKey as any);
    } catch (e: any) {
      threwWith = true;
      console.log("With idempotency_key - threw:", e.message);
    }

    console.log("\nWithout idempotency_key threw:", threwWithout);
    console.log("With idempotency_key threw:", threwWith);

    expect(threwWithout).toBe(true);
    expect(threwWith).toBe(false);
  });
});
