import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Projections, Storage, WorkLedger } from "../src/index.js";

const actor = {
  actor_id: "actor-1",
  actor_type: "human",
  display_name: "Tester",
} as const;

function makeCommand<T extends WorkLedger.WorkCommandType>(
  command_id: string,
  command_type: T,
  payload: WorkLedger.WorkCommandPayload,
  requested_at: string,
): WorkLedger.WorkCommandEnvelope<T> {
  return {
    command_id,
    command_type,
    payload,
    target_ref: "work-ledger",
    dedupe_scope: "test",
    correlation_id: `corr-${command_id}`,
    actor,
    requested_at,
  } as WorkLedger.WorkCommandEnvelope<T>;
}

describe("Work Ledger commands", () => {
  let dir: string;
  let eventsPath: string;
  let commandsPath: string;
  let outcomesPath: string;
  const timestamps = [
    "2024-01-01T00:00:00Z",
    "2024-01-01T00:00:01Z",
    "2024-01-01T00:00:02Z",
    "2024-01-01T00:00:03Z",
    "2024-01-01T00:00:04Z",
    "2024-01-01T00:00:05Z",
  ];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-work-ledger-"));
    eventsPath = join(dir, "ledger.jsonl");
    commandsPath = join(dir, "commands.jsonl");
    outcomesPath = join(dir, "outcomes.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("handles create and complete idempotently", async () => {
    const ledger = new WorkLedger.WorkLedger(
      new Storage.JsonlEventStore(eventsPath),
      new Storage.JsonlCommandLog(commandsPath, outcomesPath),
      { now: () => timestamps.shift() ?? new Date().toISOString() },
    );

    const create = makeCommand(
      "cmd-create",
      "work.create",
      { work_id: "w1", title: "Task 1" },
      "2024-01-01T00:00:00Z",
    );

    const complete = makeCommand(
      "cmd-complete",
      "work.complete",
      { work_id: "w1" },
      "2024-01-01T00:00:01Z",
    );

    const firstCreate = await ledger.execute(create);
    expect(firstCreate.status).toBe("accepted");
    expect(firstCreate.produced_events).toHaveLength(1);

    const duplicateCreate = await ledger.execute(create);
    expect(duplicateCreate.status).toBe("accepted"); // idempotent because outcome is recorded
    expect(duplicateCreate.produced_events).toHaveLength(1);

    const firstComplete = await ledger.execute(complete);
    expect(firstComplete.status).toBe("accepted");
    expect(firstComplete.produced_events).toHaveLength(1);

    const duplicateComplete = await ledger.execute(complete);
    expect(duplicateComplete.status).toBe("already_processed");
    expect(duplicateComplete.reason).toBe("Work item already completed");
  });

  it("blocks readiness until dependency is completed", async () => {
    const ledger = new WorkLedger.WorkLedger(
      new Storage.JsonlEventStore(eventsPath),
      new Storage.JsonlCommandLog(commandsPath, outcomesPath),
      { now: () => timestamps.shift() ?? new Date().toISOString() },
    );

    await ledger.execute(
      makeCommand(
        "c1",
        "work.create",
        { work_id: "parent", title: "Parent" },
        "2024-01-01T00:00:00Z",
      ),
    );
    await ledger.execute(
      makeCommand(
        "c2",
        "work.create",
        { work_id: "child", title: "Child" },
        "2024-01-01T00:00:01Z",
      ),
    );
    await ledger.execute(
      makeCommand(
        "c3",
        "work.dep.add",
        { work_id: "child", depends_on: "parent" },
        "2024-01-01T00:00:02Z",
      ),
    );

    const initialProjection = await Projections.rebuildWorkLedger(
      new Storage.JsonlEventStore(eventsPath),
    );
    expect(initialProjection.readyQueue.ready).toEqual(["parent"]);

    await ledger.execute(
      makeCommand(
        "c4",
        "work.complete",
        { work_id: "parent" },
        "2024-01-01T00:00:03Z",
      ),
    );

    const afterComplete = await Projections.rebuildWorkLedger(
      new Storage.JsonlEventStore(eventsPath),
    );
    expect(afterComplete.readyQueue.ready.sort()).toEqual(["child"]);
    expect(afterComplete.hash).toBe(
      (
        await Projections.rebuildWorkLedger(
          new Storage.JsonlEventStore(eventsPath),
        )
      ).hash,
    );
  });

  it("removes blocked items from ready queue and restores on unblock", async () => {
    const ledger = new WorkLedger.WorkLedger(
      new Storage.JsonlEventStore(eventsPath),
      new Storage.JsonlCommandLog(commandsPath, outcomesPath),
      { now: () => timestamps.shift() ?? new Date().toISOString() },
    );

    await ledger.execute(
      makeCommand(
        "b1",
        "work.create",
        { work_id: "w3", title: "Task 3" },
        "2024-01-01T00:00:00Z",
      ),
    );

    let projection = await Projections.rebuildWorkLedger(
      new Storage.JsonlEventStore(eventsPath),
    );
    expect(projection.readyQueue.ready).toContain("w3");

    await ledger.execute(
      makeCommand(
        "b2",
        "work.block",
        { work_id: "w3", reason: "waiting" },
        "2024-01-01T00:00:01Z",
      ),
    );

    projection = await Projections.rebuildWorkLedger(
      new Storage.JsonlEventStore(eventsPath),
    );
    expect(projection.readyQueue.ready).not.toContain("w3");

    await ledger.execute(
      makeCommand(
        "b3",
        "work.unblock",
        { work_id: "w3" },
        "2024-01-01T00:00:02Z",
      ),
    );

    projection = await Projections.rebuildWorkLedger(
      new Storage.JsonlEventStore(eventsPath),
    );
    expect(projection.readyQueue.ready).toContain("w3");
  });
});
