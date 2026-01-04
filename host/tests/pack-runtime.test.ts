import { afterEach, describe, expect, it, test, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  Identity,
  type CommandEnvelope,
  type EventStore,
  type CommandLog,
  type CommandOutcome,
  type EventEnvelope,
  type CommandLogTryStartResult,
  Storage,
  Projections,
} from "@aligntrue/core";

import { createPackRuntime, type PackRuntime } from "../src/pack-runtime.js";
import type { RuntimeLoadedPack } from "../src/pack-runtime.js";

let tmpDir: string;
let trajectoryStore: Storage.TrajectoryStore;

afterEach(async () => {
  if (trajectoryStore) {
    await trajectoryStore.close();
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

async function makeStores(): Promise<{
  eventStore: EventStore;
  commandLog: CommandLog;
  trajectoryStore: Storage.JsonlTrajectoryStore;
}> {
  tmpDir = await mkdtemp(join(tmpdir(), "pack-rt-"));
  const trajectoryPath = join(tmpDir, "trajectories.jsonl");
  const outcomesPath = join(tmpDir, "outcomes.jsonl");
  const dbPath = join(tmpDir, "trajectories.db");

  trajectoryStore = new Storage.JsonlTrajectoryStore({
    trajectoryPath,
    outcomesPath,
    dbPath,
  });

  return {
    eventStore: new Storage.JsonlEventStore(join(tmpDir, "events.jsonl")),
    commandLog: new Storage.JsonlCommandLog(
      join(tmpDir, "commands.jsonl"),
      join(tmpDir, "command-outcomes.jsonl"),
      { allowExternalPaths: true },
    ),
    trajectoryStore: trajectoryStore as Storage.JsonlTrajectoryStore,
  };
}

function buildCommand(
  command_type: string,
  target_ref: string,
): CommandEnvelope {
  const now = new Date().toISOString();
  return {
    command_id: Identity.randomId(),
    idempotency_key: Identity.randomId(),
    command_type,
    payload: { msg: "hi" },
    dedupe_scope: "actor",
    target_ref,
    actor: { actor_id: "actor-1", actor_type: "human" },
    requested_at: now,
    correlation_id: "corr-test",
  };
}

const HELLO_EVENT = "pack.hello-world.greeting.emitted";

class InMemoryEventStore implements EventStore {
  readonly events: EventEnvelope[] = [];
  async append(event: EventEnvelope): Promise<void> {
    this.events.push(event);
  }
  async *stream(): AsyncIterable<EventEnvelope> {
    for (const e of this.events) yield e;
  }
  async getById(eventId: string): Promise<EventEnvelope | null> {
    return this.events.find((e) => e.event_id === eventId) ?? null;
  }
}

class InMemoryCommandLog implements CommandLog {
  readonly outcomes = new Map<string, CommandOutcome>();
  private readonly pending = new Set<string>();
  async record(command: CommandEnvelope): Promise<void> {
    // no-op
    void command;
  }
  async recordOutcome(outcome: CommandOutcome): Promise<void> {
    this.outcomes.set(outcome.command_id, outcome);
  }
  async getByIdempotencyKey(commandId: string): Promise<CommandOutcome | null> {
    return this.outcomes.get(commandId) ?? null;
  }
  async tryStart(): Promise<CommandLogTryStartResult> {
    return { status: "new" };
  }
  async complete(commandId: string, outcome: CommandOutcome): Promise<void> {
    this.pending.delete(commandId);
    this.outcomes.set(commandId, outcome);
  }
}

function minimalEvent(): EventEnvelope {
  return {
    event_id: "evt_1",
    event_type: HELLO_EVENT,
    payload: {},
    occurred_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    correlation_id: "corr_1",
    actor: { actor_id: "test", actor_type: "service" },
    envelope_version: 1,
    payload_schema_version: 1,
  };
}

async function createRuntime(): Promise<PackRuntime> {
  const eventStore = new InMemoryEventStore();
  const commandLog = new InMemoryCommandLog();
  const projectionRegistry = new Projections.ProjectionRegistry();
  return createPackRuntime({ eventStore, commandLog, projectionRegistry });
}

function helloWorldSpecifier(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = resolve(here, "../../packs/hello-world/src/index.ts");
  return pathToFileURL(p).href;
}

describe("PackRuntime", () => {
  describe("trajectories", () => {
    it("emits trajectory steps on command dispatch when enabled", async () => {
      const { eventStore, commandLog, trajectoryStore } = await makeStores();
      const runtime = await createPackRuntime({
        eventStore,
        commandLog,
        trajectoryStore,
        enableTrajectories: true,
        appName: "test-app",
      });

      const manifest = {
        pack_id: "demo-pack",
        version: "1.0.0",
        integrity: "dev",
        public_commands: ["demo.echo"],
        capabilities_requested: ["demo.echo"],
        name: "demo",
      };

      const handler = async () => ({ status: "accepted" as const });
      const loaded: RuntimeLoadedPack = {
        manifest,
        module: { manifest, commandHandlers: { "demo.echo": handler } },
      };
      runtime.packs.set(manifest.pack_id, loaded);

      const command = buildCommand("demo.echo", "entity:1");
      const outcome = await runtime.dispatchCommand(command);
      expect(outcome.status).toBe("accepted");

      const list = await trajectoryStore.listTrajectories({
        filters: {},
        limit: 10,
        sort: "time_desc",
      } as any);
      expect(list.ids.length).toBe(1);

      const steps = await trajectoryStore.readTrajectory(list.ids[0]);
      const types = steps.map((s) => s.step_type);
      expect(types).toContain("trajectory_started");
      expect(types).toContain("entity_written");
      expect(types).toContain("trajectory_ended");

      const write = steps.find((s) => s.step_type === "entity_written");
      expect(write?.causation?.related_command_id).toBe(command.command_id);
      expect(write?.correlation_id).toBe(command.correlation_id);
    });
  });

  test("loads pack and registers projections", async () => {
    const runtime = await createRuntime();
    await runtime.loadPack(helloWorldSpecifier());

    expect(runtime.packs.has("hello-world")).toBe(true);
    const proj = runtime.projectionRegistry.get(
      Projections.projectionKey("hello-world-items", "1.0.0"),
    );
    expect(proj).toBeDefined();
  });

  test("unloads pack and unregisters projections", async () => {
    const runtime = await createRuntime();
    await runtime.loadPack(helloWorldSpecifier());
    await runtime.unloadPack("hello-world");

    expect(runtime.packs.has("hello-world")).toBe(false);
    const proj = runtime.projectionRegistry.get(
      Projections.projectionKey("hello-world-items", "1.0.0"),
    );
    expect(proj).toBeUndefined();
  });

  test("dispatch routes to pack handler", async () => {
    const runtime = await createRuntime();
    await runtime.loadPack(helloWorldSpecifier());

    const loaded = runtime.packs.get("hello-world");
    expect(loaded).toBeDefined();

    const spy = vi.fn();
    if (loaded?.module.handlers) {
      loaded.module.handlers[HELLO_EVENT] = spy;
    }

    await runtime.dispatchEvent(minimalEvent());
    expect(spy).toHaveBeenCalledOnce();
  });

  test("runtime works with zero packs", async () => {
    const runtime = await createRuntime();
    expect(runtime.packs.size).toBe(0);
    await runtime.dispatchEvent(minimalEvent()); // should not throw
  });
});
