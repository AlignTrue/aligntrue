import { describe, expect, it } from "vitest";
import { Outbox } from "../src/index.js";

const dummyEvent = {
  event_id: "e1",
  event_type: "test",
  payload: {},
  occurred_at: "2024-01-01T00:00:00Z",
  ingested_at: "2024-01-01T00:00:00Z",
  correlation_id: "corr",
  actor: { actor_id: "a1", actor_type: "human" },
  capability_scope: [],
  schema_version: 1,
};

describe("in-memory outbox", () => {
  it("enqueues and marks dispatched", async () => {
    const outbox = new Outbox.InMemoryOutbox();
    const entry = outbox.enqueue(dummyEvent);
    expect(entry.event_id).toBe("e1");

    outbox.markDispatched(entry.entry_id);
    const stored = outbox.list().find((e) => e.entry_id === entry.entry_id);
    expect(stored?.dispatched_at).toBeTruthy();
  });
});
