import { describe, expect, it } from "vitest";
import { Envelopes } from "../src/index.js";

describe("debug", () => {
  it.skip("debug test", () => {
    const actor = {
      actor_id: "actor-1",
      actor_type: "human" as const,
      display_name: "Test User",
    };

    const command = {
      command_id: "c1",
      command_type: "do",
      payload: { ok: true },
      target_ref: "target-1",
      dedupe_scope: "tenant-1",
      correlation_id: "corr-1",
      actor,
      requested_at: "2024-01-01T00:00:00Z",
    };

    console.log(
      "validateCommandEnvelope:",
      Envelopes.validateCommandEnvelope.toString().slice(0, 200),
    );

    try {
      const _validated = Envelopes.validateCommandEnvelope(command as any);
      console.log("Validation PASSED");
      expect(true).toBe(false); // Should have thrown
    } catch (e: any) {
      console.log("Validation FAILED:", e.message);
      expect(e.message).toContain("idempotency_key");
    }
  });
});
