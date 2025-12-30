import type {
  CommandEnvelope,
  CommandLog,
  CommandOutcome,
  EventEnvelope,
  EventStore,
  PackContext,
  PackManifest,
  PackModule,
  PackCommandHandler,
  ProjectionRegistry,
} from "@aligntrue/ops-core";
import {
  Projections,
  validateDedupeScope,
  computeScopeKey,
  validatePackEventType,
} from "@aligntrue/ops-core";

export interface RuntimeLoadedPack {
  manifest: PackManifest;
  module: PackModule;
}

export interface PackRuntimeOptions {
  eventStore: EventStore;
  commandLog: CommandLog;
  projectionRegistry?: ProjectionRegistry;
  config?: Record<string, Record<string, unknown>>; // keyed by pack_id
  appName?: string;
}

export interface PackRuntime {
  readonly packs: Map<string, RuntimeLoadedPack>;
  readonly projectionRegistry: ProjectionRegistry;
  loadPack(specifier: string): Promise<void>;
  unloadPack(packId: string): Promise<void>;
  dispatchEvent(event: EventEnvelope): Promise<void>;
  dispatchCommand(command: CommandEnvelope): Promise<CommandOutcome>;
  getPackForCommand(commandType: string): RuntimeLoadedPack | undefined;
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
    // Use webpackIgnore to defer resolution to runtime (Next/Turbopack safe)
    const imported = (await import(
      /* webpackIgnore: true */ specifier as string
    )) as { default?: PackModule } | PackModule;
    const moduleCandidate = (
      imported && "default" in imported ? imported.default : imported
    ) as PackModule;
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

  async function dispatchCommand(
    command: CommandEnvelope,
  ): Promise<CommandOutcome> {
    // Validate dedupe scope requirements first
    const dedupeError = validateDedupeScope(command);
    if (dedupeError) {
      return {
        command_id: command.command_id,
        status: "rejected",
        reason: dedupeError,
      };
    }

    const scopeKey = computeScopeKey(
      command.dedupe_scope,
      command,
      opts.appName ?? "unknown",
    );

    const start = await opts.commandLog.tryStart({
      command_id: command.command_id,
      idempotency_key: command.idempotency_key,
      dedupe_scope: command.dedupe_scope,
      scope_key: scopeKey,
    });

    if (start.status === "duplicate") {
      return start.outcome;
    }
    if (start.status === "in_flight") {
      return {
        command_id: command.command_id,
        status: "already_processing",
        reason: "Command in flight",
      };
    }

    const pack = getPackForCommand(command.command_type);
    if (!pack) {
      const rejection: CommandOutcome = {
        command_id: command.command_id,
        status: "rejected",
        reason: "Pack not loaded for command",
      };
      await opts.commandLog.complete(command.command_id, rejection);
      return rejection;
    }

    const handler =
      pack.module.commandHandlers?.[command.command_type] ??
      pack.module.handlers?.[command.command_type];
    if (!handler) {
      const rejection: CommandOutcome = {
        command_id: command.command_id,
        status: "rejected",
        reason: "Command handler not found",
      };
      await opts.commandLog.complete(command.command_id, rejection);
      return rejection;
    }

    const handledBy = {
      pack_id: pack.manifest.pack_id,
      pack_version: pack.manifest.version,
      pack_integrity: pack.manifest.integrity ?? "unknown",
    };

    try {
      const outcome = await (handler as PackCommandHandler)(
        command,
        createContext(pack.manifest.pack_id),
      );
      const normalizedOutcome: CommandOutcome = {
        command_id: command.command_id,
        status: outcome?.status ?? "accepted",
        handled_by: handledBy,
        ...(outcome?.produced_events !== undefined
          ? { produced_events: outcome.produced_events }
          : {}),
        ...(outcome?.reason !== undefined ? { reason: outcome.reason } : {}),
        ...(outcome?.completed_at !== undefined
          ? { completed_at: outcome.completed_at }
          : {}),
      };
      await opts.commandLog.complete(command.command_id, normalizedOutcome);
      return normalizedOutcome;
    } catch (err) {
      const failure: CommandOutcome = {
        command_id: command.command_id,
        status: "failed",
        reason: err instanceof Error ? err.message : "Unknown error",
        handled_by: handledBy,
      };
      await opts.commandLog.complete(command.command_id, failure);
      return failure;
    }
  }

  function getPackForCommand(
    commandType: string,
  ): RuntimeLoadedPack | undefined {
    for (const pack of packs.values()) {
      if (pack.manifest.public_commands?.includes(commandType)) {
        return pack;
      }
    }
    return undefined;
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
    dispatchCommand,
    getPackForCommand,
  };
}
