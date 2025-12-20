import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Identity, Projections, Storage, WorkLedger } from "../src/index.js";

const actor = { actor_id: "actor-2", actor_type: "human" } as const;

describe("work ledger projections", () => {
  let dir: string;
  let eventsPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-projections-"));
    eventsPath = join(dir, "events.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("rebuilds deterministically from event log", async () => {
    const store = new Storage.JsonlEventStore(eventsPath);
    const now = "2024-01-01T00:00:00Z";

    const events: WorkLedger.WorkLedgerEvent[] = [
      {
        event_id: Identity.generateEventId(),
        event_type: WorkLedger.WORK_EVENT_TYPES.WorkItemCreated,
        payload: { work_id: "a", title: "Task A" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-1",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
      {
        event_id: Identity.generateEventId(),
        event_type: WorkLedger.WORK_EVENT_TYPES.WorkItemCreated,
        payload: { work_id: "b", title: "Task B" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-2",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
      {
        event_id: Identity.generateEventId(),
        event_type: WorkLedger.WORK_EVENT_TYPES.DependencyAdded,
        payload: { work_id: "b", depends_on: "a" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-3",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
      {
        event_id: Identity.generateEventId(),
        event_type: WorkLedger.WORK_EVENT_TYPES.WorkItemCompleted,
        payload: { work_id: "a" },
        occurred_at: now,
        ingested_at: now,
        correlation_id: "corr-4",
        actor,
        capability_scope: [],
        schema_version: WorkLedger.WORK_LEDGER_SCHEMA_VERSION,
      },
    ];

    for (const event of events) {
      await store.append(event);
    }

    const first = await Projections.rebuildWorkLedger(store);
    const second = await Projections.rebuildWorkLedger(store);

    expect(first.hash).toBe(second.hash);
    expect(first.readyQueue.ready).toEqual(["b"]);
  });
});
