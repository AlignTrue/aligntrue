import type { CommandLog, EventStore } from "@aligntrue/ops-core";
import { Storage, Identity, Projections, Envelopes } from "@aligntrue/ops-core";
import { createPackRuntime, type PackRuntime } from "./pack-runtime.js";

export interface HostConfig {
  packs?: string[];
  config?: Record<string, Record<string, unknown>>;
}

export interface Host {
  readonly runtime: PackRuntime;
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly Storage: typeof Storage;
  readonly Identity: typeof Identity;
  readonly Projections: typeof Projections;
  readonly Envelopes: typeof Envelopes;
}

export async function createHost(config?: HostConfig): Promise<Host> {
  const eventStore = new Storage.JsonlEventStore();
  const commandLog = new Storage.JsonlCommandLog();
  const runtime = await createPackRuntime({
    eventStore,
    commandLog,
    config: config?.config ?? {},
  });

  if (config?.packs?.length) {
    for (const specifier of config.packs) {
      await runtime.loadPack(specifier);
    }
  }

  return {
    runtime,
    eventStore,
    commandLog,
    Storage,
    Identity,
    Projections,
    Envelopes,
  };
}
