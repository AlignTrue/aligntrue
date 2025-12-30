import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test, vi } from "vitest";
import {
  Projections,
  type CommandLog,
  type CommandOutcome,
  type CommandEnvelope,
  type EventEnvelope,
  type EventStore,
} from "@aligntrue/ops-core";
import { createPackRuntime, type PackRuntime } from "../src/pack-runtime.js";

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
  const p = resolve(here, "../../packs/hello-world/src/index.js");
  return pathToFileURL(p).href;
}

describe("PackRuntime", () => {
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
