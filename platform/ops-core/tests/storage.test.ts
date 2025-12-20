import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Storage } from "../src/index.js";

const actor = { actor_id: "a1", actor_type: "human" } as const;

describe("JSONL storage", () => {
  let dir: string;
  let eventsPath: string;
  let commandsPath: string;
  let outcomesPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-storage-"));
    eventsPath = join(dir, "events.jsonl");
    commandsPath = join(dir, "commands.jsonl");
    outcomesPath = join(dir, "outcomes.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("appends and streams events", async () => {
    const store = new Storage.JsonlEventStore(eventsPath);
    const event = {
      event_id: "e1",
      event_type: "test",
      payload: { ok: true },
      occurred_at: "2024-01-01T00:00:00Z",
      ingested_at: "2024-01-01T00:00:01Z",
      correlation_id: "corr-1",
      actor,
      capability_scope: ["read"],
      schema_version: 1,
    };
    await store.append(event);

    const collected: unknown[] = [];
    for await (const ev of store.stream()) {
      collected.push(ev);
    }
    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({ event_id: "e1" });

    const fetched = await store.getById("e1");
    expect(fetched?.event_type).toBe("test");
  });

  it("records command outcomes idempotently", async () => {
    const log = new Storage.JsonlCommandLog(commandsPath, outcomesPath);
    const command = {
      command_id: "c1",
      command_type: "do",
      payload: {},
      target_ref: "t",
      dedupe_scope: "tenant",
      correlation_id: "corr",
      actor,
      requested_at: "2024-01-01T00:00:00Z",
    };
    const outcome = {
      command_id: "c1",
      status: "accepted" as const,
      produced_events: ["e1"],
      completed_at: "2024-01-01T00:00:01Z",
    };

    await log.record(command);
    await log.recordOutcome(outcome);

    const fetched = await log.getByIdempotencyKey("c1");
    expect(fetched?.status).toBe("accepted");
  });
});
