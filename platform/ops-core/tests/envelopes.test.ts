import { describe, expect, it } from "vitest";
import {
  Envelopes,
  ValidationError,
  IdempotencyViolation,
  PreconditionFailed,
} from "../src/index.js";

const actor: Envelopes.ActorRef = {
  actor_id: "actor-1",
  actor_type: "human",
  display_name: "Test User",
};

describe("envelopes validation", () => {
  it("validates event envelope", () => {
    const envelope: Envelopes.EventEnvelope = {
      event_id: "e1",
      event_type: "test",
      payload: { ok: true },
      occurred_at: "2024-01-01T00:00:00Z",
      ingested_at: "2024-01-01T00:00:01Z",
      correlation_id: "corr-1",
      actor,
      envelope_version: 1,
      payload_schema_version: 1,
    };

    const validated = Envelopes.validateEventEnvelope(envelope);
    expect(validated.event_id).toBe("e1");
  });

  it("throws on missing event field", () => {
    expect(() =>
      Envelopes.validateEventEnvelope({
        event_id: "e1",
        // missing event_type
      } as Partial<Envelopes.EventEnvelope>),
    ).toThrow(ValidationError);
  });

  it("validates command envelope", () => {
    const command: Envelopes.CommandEnvelope = {
      command_id: "c1",
      command_type: "do",
      payload: { ok: true },
      target_ref: "target-1",
      dedupe_scope: "tenant-1",
      correlation_id: "corr-1",
      actor,
      requested_at: "2024-01-01T00:00:00Z",
    };
    const validated = Envelopes.validateCommandEnvelope(command);
    expect(validated.command_id).toBe("c1");
  });

  it("throws on missing command field", () => {
    expect(() =>
      Envelopes.validateCommandEnvelope({
        command_id: "c1",
      } as Partial<Envelopes.CommandEnvelope>),
    ).toThrow(ValidationError);
  });
});

describe("error types", () => {
  it("constructs idempotency violation", () => {
    const err = new IdempotencyViolation("cmd-1");
    expect(err.code).toBe("IDEMPOTENCY_VIOLATION");
  });

  it("constructs precondition failed", () => {
    const err = new PreconditionFailed(1, 2);
    expect(err.code).toBe("PRECONDITION_FAILED");
  });
});
