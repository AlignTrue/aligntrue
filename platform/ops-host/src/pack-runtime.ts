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
  Identity,
  Contracts,
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
      await moduleCandidate.init(
        createContext(packId, undefined, [], moduleCandidate),
      );
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

    const childCommands: string[] = [];
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
        createContext(pack.manifest.pack_id, command, childCommands),
      );
      const mergedChildCommands = [
        ...childCommands,
        ...(outcome?.child_commands ?? []),
      ];
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
        ...(mergedChildCommands.length
          ? { child_commands: mergedChildCommands }
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
        ...(childCommands.length ? { child_commands: childCommands } : {}),
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

  function buildDispatchChild(
    parentPackId: string,
    parentCommand: CommandEnvelope | undefined,
    childCommands: string[],
  ) {
    if (!parentCommand) {
      return async () => {
        throw new Error(
          "dispatchChild is only available during command handling",
        );
      };
    }

    return async (
      child: Omit<
        CommandEnvelope,
        | "actor"
        | "correlation_id"
        | "causation_id"
        | "command_id"
        | "idempotency_key"
        | "requested_at"
      > &
        Partial<Pick<CommandEnvelope, "command_id" | "idempotency_key">>,
    ): Promise<CommandOutcome> => {
      const destinationPack = getPackForCommand(child.command_type);
      const destPackId = destinationPack?.manifest.pack_id ?? "unknown";
      const now = new Date().toISOString();
      const childCommandId = child.command_id ?? Identity.randomId();
      const idempotencyKey =
        child.idempotency_key ??
        Identity.deterministicId({
          parent_command_id: parentCommand.command_id,
          dest_pack_id: destPackId,
          command_type: child.command_type,
          target_ref: child.target_ref ?? "__missing_target__",
          dedupe_scope: child.dedupe_scope,
        });

      const childEnvelope: CommandEnvelope = {
        ...child,
        command_id: childCommandId,
        idempotency_key: idempotencyKey,
        actor: parentCommand.actor,
        correlation_id: parentCommand.correlation_id,
        causation_id: parentCommand.command_id,
        requested_at: now,
        capability_id: child.capability_id ?? child.command_type,
        invoked_by: {
          pack_id: parentPackId,
          command_id: parentCommand.command_id,
        },
      } as CommandEnvelope;

      const outcome = await dispatchCommand(childEnvelope);
      childCommands.push(childCommandId);

      await emitChildDispatched(
        childEnvelope,
        parentCommand,
        parentPackId,
        destPackId,
        idempotencyKey,
      );

      return outcome;
    };
  }

  async function emitChildDispatched(
    child: CommandEnvelope,
    parentCommand: CommandEnvelope,
    parentPackId: string,
    destPackId: string,
    idempotencyKey: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const payload: Contracts.ChildDispatchedPayload = {
      parent_command_id: parentCommand.command_id,
      parent_command_type: parentCommand.command_type,
      child_command_id: child.command_id,
      child_command_type: child.command_type,
      ...(child.target_ref !== undefined
        ? { child_target_ref: child.target_ref }
        : {}),
      invoked_by_pack_id: parentPackId,
      child_idempotency_key: idempotencyKey,
      dedupe_scope: child.dedupe_scope,
    };
    const event: EventEnvelope<
      (typeof Contracts.HOST_EVENT_TYPES)["ChildDispatched"],
      Contracts.ChildDispatchedPayload
    > = {
      event_id: Identity.generateEventId(payload),
      event_type: Contracts.HOST_EVENT_TYPES.ChildDispatched,
      payload,
      occurred_at: now,
      ingested_at: now,
      correlation_id: child.correlation_id,
      causation_id: child.causation_id ?? child.command_id,
      actor: child.actor,
      envelope_version: 1,
      payload_schema_version: 1,
    };
    await opts.eventStore.append(event);
  }

  function createContext(
    packId: string,
    parentCommand?: CommandEnvelope,
    childCommands: string[] = [],
    moduleOverride?: PackModule,
  ): PackContext {
    const baseContext: PackContext = {
      eventStore: opts.eventStore,
      commandLog: opts.commandLog,
      projectionRegistry,
      config: configByPack.get(packId) ?? {},
      dispatchChild: buildDispatchChild(packId, parentCommand, childCommands),
    };

    const moduleRef = moduleOverride ?? packs.get(packId)?.module;
    if (moduleRef?.extendContext) {
      return moduleRef.extendContext(baseContext, {
        packId,
        ...(parentCommand !== undefined ? { parentCommand } : {}),
        childCommands,
      });
    }

    return baseContext;
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
