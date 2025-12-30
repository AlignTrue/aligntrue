import type {
  CommandLog,
  EventEnvelope,
  EventStore,
  PackContext,
  PackManifest,
  PackModule,
  ProjectionRegistry,
} from "@aligntrue/ops-core";
import { Projections, validatePackEventType } from "@aligntrue/ops-core";

export interface RuntimeLoadedPack {
  manifest: PackManifest;
  module: PackModule;
}

export interface PackRuntimeOptions {
  eventStore: EventStore;
  commandLog: CommandLog;
  projectionRegistry?: ProjectionRegistry;
  config?: Record<string, Record<string, unknown>>; // keyed by pack_id
}

export interface PackRuntime {
  readonly packs: Map<string, RuntimeLoadedPack>;
  readonly projectionRegistry: ProjectionRegistry;
  loadPack(specifier: string): Promise<void>;
  unloadPack(packId: string): Promise<void>;
  dispatchEvent(event: EventEnvelope): Promise<void>;
}

export async function createPackRuntime(
  opts: PackRuntimeOptions,
): Promise<PackRuntime> {
  const packs = new Map<string, RuntimeLoadedPack>();
  const projectionRegistry =
    opts.projectionRegistry ?? Projections.defaultRegistry;
  const configByPack = new Map<string, Record<string, unknown>>(
    Object.entries(opts.config ?? {}),
  );

  async function loadPack(specifier: string): Promise<void> {
    const imported = await import(specifier);
    const moduleCandidate = (imported?.default ?? imported) as PackModule;
    if (!moduleCandidate?.manifest) {
      throw new Error(`Pack manifest not found in ${specifier}`);
    }
    const manifest = moduleCandidate.manifest;
    const packId = manifest.pack_id;

    // Register projections provided by the pack
    if (moduleCandidate.projections) {
      for (const def of moduleCandidate.projections) {
        projectionRegistry.register(def);
      }
    }

    // Call init hook
    if (moduleCandidate.init) {
      await moduleCandidate.init(createContext(packId));
    }

    packs.set(packId, { manifest, module: moduleCandidate });
  }

  async function unloadPack(packId: string): Promise<void> {
    const loaded = packs.get(packId);
    if (!loaded) return;

    if (loaded.module.dispose) {
      await loaded.module.dispose();
    }

    if (loaded.module.projections) {
      for (const def of loaded.module.projections) {
        projectionRegistry.unregister(def.name, def.version);
      }
    }

    packs.delete(packId);
  }

  async function dispatchEvent(event: EventEnvelope): Promise<void> {
    // Route only pack-scoped events: pack.<packId>.<...>
    if (!event.event_type.startsWith("pack.")) return;
    const parts = event.event_type.split(".");
    if (parts.length < 3) return;
    const packId = parts[1];
    if (!packId) return;
    const loaded = packs.get(packId);
    if (!loaded) return;

    // Optional validation against manifest namespace
    if (!validatePackEventType(packId, event.event_type)) {
      return;
    }

    const handler = loaded.module.handlers?.[event.event_type];
    if (!handler) return;
    await handler(event, createContext(packId));
  }

  function createContext(packId: string): PackContext {
    return {
      eventStore: opts.eventStore,
      commandLog: opts.commandLog,
      projectionRegistry,
      config: configByPack.get(packId) ?? {},
    };
  }

  return {
    packs,
    projectionRegistry,
    loadPack,
    unloadPack,
    dispatchEvent,
  };
}
