import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Identity, Projections, Storage, WorkLedger } from "../src/index.js";

const actor = { actor_id: "actor-2", actor_type: "human" } as const;

describe("work ledger projections", () => {
  let dir: string;
  let eventsPath: string;
  let now: string;
  let events: WorkLedger.WorkLedgerEvent[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-projections-"));
    eventsPath = join(dir, "events.jsonl");
    now = "2024-01-01T00:00:00Z";
    events = [
      {
        event_id: Identity.generateEventId({
          work_id: "a",
          correlation_id: "corr-1",
        }),
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
        event_id: Identity.generateEventId({
          work_id: "b",
          correlation_id: "corr-2",
        }),
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
        event_id: Identity.generateEventId({
          work_id: "b",
          depends_on: "a",
          correlation_id: "corr-3",
        }),
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
        event_id: Identity.generateEventId({
          work_id: "a",
          correlation_id: "corr-4",
        }),
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
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("rebuilds deterministically from event log", async () => {
    const store = await writeEvents(eventsPath, events);

    const first = await Projections.rebuildWorkLedger(store);
    const second = await Projections.rebuildWorkLedger(store);

    expect(first.hash).toBe(second.hash);
    expect(first.readyQueue.ready).toEqual(["b"]);
  });

  it("rebuildOne matches rebuildAll for a single registered projection", async () => {
    const store = await writeEvents(eventsPath, events);
    const registry = new Projections.ProjectionRegistry().register(
      Projections.WorkItemsProjectionDef,
    );

    const all = await Projections.rebuildAll(registry, store);
    const single = await Projections.rebuildOne(
      Projections.WorkItemsProjectionDef,
      store,
    );

    const key = Projections.projectionKey(
      Projections.WorkItemsProjectionDef.name,
      Projections.WorkItemsProjectionDef.version,
    );

    const fromAll = all.get(key);
    expect(fromAll?.hash).toBe(single.hash);
    expect(fromAll?.freshness.last_event_id).toBe(
      events[events.length - 1].event_id,
    );
  });

  it("rebuildAll runs registered projections deterministically", async () => {
    const store = await writeEvents(eventsPath, events);
    const registry = new Projections.ProjectionRegistry()
      .register(Projections.WorkItemsProjectionDef)
      .register(Projections.ReadyQueueProjectionDef);

    const first = await Projections.rebuildAll(registry, store);
    const second = await Projections.rebuildAll(registry, store);

    const firstKeys = Array.from(first.keys());
    const secondKeys = Array.from(second.keys());

    expect(firstKeys).toEqual(secondKeys);
    for (const key of firstKeys) {
      expect(first.get(key)?.hash).toBe(second.get(key)?.hash);
    }
  });

  it("updates freshness metadata with the latest ingested event", async () => {
    const store = await writeEvents(eventsPath, events);
    const registry = new Projections.ProjectionRegistry().register(
      Projections.WorkItemsProjectionDef,
    );
    const outputs = await Projections.rebuildAll(registry, store);
    const key = Projections.projectionKey(
      Projections.WorkItemsProjectionDef.name,
      Projections.WorkItemsProjectionDef.version,
    );
    const projection = outputs.get(key);
    expect(projection?.freshness.last_event_id).toBe(
      events[events.length - 1].event_id,
    );
    expect(projection?.freshness.last_ingested_at).toBe(now);
  });

  it("keeps outputs separate when projection version changes", async () => {
    const store = await writeEvents(eventsPath, events);

    const v2WorkItems = {
      ...Projections.WorkItemsProjectionDef,
      version: "2.0.0",
    };

    const registry = new Projections.ProjectionRegistry()
      .register(Projections.WorkItemsProjectionDef)
      .register(v2WorkItems);

    const outputs = await Projections.rebuildAll(registry, store);

    const v1Key = Projections.projectionKey(
      Projections.WorkItemsProjectionDef.name,
      Projections.WorkItemsProjectionDef.version,
    );
    const v2Key = Projections.projectionKey(
      v2WorkItems.name,
      v2WorkItems.version,
    );

    expect(outputs.has(v1Key)).toBe(true);
    expect(outputs.has(v2Key)).toBe(true);
    expect(outputs.get(v1Key)?.data).toEqual(outputs.get(v2Key)?.data);
    expect(outputs.get(v1Key)?.hash).not.toBe(outputs.get(v2Key)?.hash);
  });
});

async function writeEvents(
  eventsPath: string,
  events: WorkLedger.WorkLedgerEvent[],
) {
  const store = new Storage.JsonlEventStore(eventsPath);
  for (const event of events) {
    await store.append(event);
  }
  return store;
}
