import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import {
  Contracts,
  Storage,
  Identity,
  Projections,
  Envelopes,
  validateDedupeScope,
  type CommandEnvelope,
  type CommandLog,
  type CommandOutcome,
  type EventStore,
} from "@aligntrue/ops-core";
const { computePackIntegrity, HOST_EVENT_TYPES } = Contracts;
type AppManifest = Contracts.AppManifest;
type PackReference = Contracts.PackReference;
type ResolvedPack = Contracts.ResolvedPack;
type CommandRejectedPayload = Contracts.CommandRejectedPayload;
type PacksLoadedPayload = Contracts.PacksLoadedPayload;
type PackLoadFailedPayload = Contracts.PackLoadFailedPayload;

import { createPackRuntime, type PackRuntime } from "./pack-runtime.js";

export interface HostConfig {
  manifest?: AppManifest;
  packs?: string[];
  config?: Record<string, Record<string, unknown>>;
}

export interface Host {
  readonly runtime: PackRuntime;
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly hostRunId: string;
  readonly Storage: typeof Storage;
  readonly Identity: typeof Identity;
  readonly Projections: typeof Projections;
  readonly Envelopes: typeof Envelopes;
}

export async function createHost(config?: HostConfig): Promise<Host> {
  const hostRunId = Identity.randomId();
  const correlationId = Identity.randomId();
  const eventStore = new Storage.JsonlEventStore();
  const commandLog = new Storage.JsonlCommandLog();
  const runtime = await createPackRuntime({
    eventStore,
    commandLog,
    appName: config?.manifest?.name ?? "unknown",
    config: config?.config ?? {},
  });

  if (config?.manifest?.packs?.length) {
    const resolvedPacks: ResolvedPack[] = [];
    for (const packRef of config.manifest.packs) {
      try {
        const resolved = await resolvePack(packRef);
        // Compute integrity (dist must exist)
        try {
          resolved.integrity = await computePackIntegrity(
            resolved.distPath ??
              join(dirname(resolved.entryPath ?? ""), "dist"),
          );
        } catch (err) {
          await emitLoadFailed(
            eventStore,
            {
              host_run_id: hostRunId,
              app_name: config.manifest.name,
              app_version: config.manifest.version,
              pack_name: packRef.name,
              requested_version: packRef.version,
              error: err instanceof Error ? err.message : "dist missing",
              reason: "dist_missing",
            },
            correlationId,
          );
          throw err;
        }

        // Version check (strict equality for Phase 3)
        if (resolved.resolved_version !== packRef.version) {
          await emitLoadFailed(
            eventStore,
            {
              host_run_id: hostRunId,
              app_name: config.manifest.name,
              app_version: config.manifest.version,
              pack_name: packRef.name,
              requested_version: packRef.version,
              error: `Version mismatch: requested ${packRef.version}, found ${resolved.resolved_version}`,
              reason: "version_mismatch",
            },
            correlationId,
          );
          throw new Error(
            `Pack ${packRef.name}: requested ${packRef.version}, found ${resolved.resolved_version}`,
          );
        }

        // Integrity check (if provided)
        if (packRef.integrity && resolved.integrity !== packRef.integrity) {
          await emitLoadFailed(
            eventStore,
            {
              host_run_id: hostRunId,
              app_name: config.manifest.name,
              app_version: config.manifest.version,
              pack_name: packRef.name,
              requested_version: packRef.version,
              error: "Integrity mismatch",
              reason: "integrity_mismatch",
            },
            correlationId,
          );
          throw new Error(`Pack ${packRef.name}: integrity mismatch`);
        }

        await runtime.loadPack(resolved.entryPath ?? resolved.name);
        resolvedPacks.push(resolved);
      } catch (err) {
        if (!(err instanceof Error && err.message.includes("integrity"))) {
          await emitLoadFailed(
            eventStore,
            {
              host_run_id: hostRunId,
              app_name: config!.manifest!.name,
              app_version: config!.manifest!.version,
              pack_name: packRef.name,
              requested_version: packRef.version,
              error: err instanceof Error ? err.message : "load error",
              reason: "load_error",
            },
            correlationId,
          );
        }
        throw err;
      }
    }

    await emitPacksLoaded(
      eventStore,
      {
        host_run_id: hostRunId,
        app_name: config.manifest.name,
        app_version: config.manifest.version,
        packs_requested: config.manifest.packs,
        packs_resolved: resolvedPacks,
        config_hash: Identity.hashCanonical(config.config ?? {}),
        load_duration_ms: 0,
      },
      correlationId,
    );
  } else if (config?.packs?.length) {
    for (const specifier of config.packs) {
      await runtime.loadPack(specifier);
    }
  }

  const wrappedRuntime = wrapRuntimeWithCapabilityEnforcement(
    runtime,
    config?.manifest,
    eventStore,
  );

  return {
    runtime: wrappedRuntime,
    eventStore,
    commandLog,
    hostRunId,
    Storage,
    Identity,
    Projections,
    Envelopes,
  };
}

async function resolvePack(packRef: PackReference): Promise<ResolvedPack> {
  const _nodeRequire = createRequire(import.meta.url);
  // Use eval to hide require.resolve from bundlers like Turbopack

  const pkgJsonPath = eval("_nodeRequire").resolve(
    `${packRef.name}/package.json`,
    { paths: [process.cwd()] },
  );
  const pkgDir = dirname(pkgJsonPath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
    version: string;
    exports?: Record<string, unknown> | string;
    main?: string;
    module?: string;
  };

  const exportsRoot = (
    typeof pkg.exports === "object" && pkg.exports !== null
      ? (pkg.exports["."] ?? pkg.exports)
      : pkg.exports
  ) as Record<string, string> | string | undefined;

  const exportImport =
    (typeof exportsRoot === "object" && exportsRoot !== null
      ? (exportsRoot["import"] ?? exportsRoot["default"])
      : undefined) ?? pkg.module;
  const entryPath = resolve(
    pkgDir,
    exportImport ?? pkg.main ?? "dist/index.js",
  );
  const distPath = resolve(pkgDir, "dist");

  return {
    name: packRef.name,
    requested_version: packRef.version,
    resolved_version: pkg.version,
    integrity: "",
    source: packRef.source ?? "workspace",
    distPath,
    entryPath,
  };
}

function wrapRuntimeWithCapabilityEnforcement(
  runtime: PackRuntime,
  manifest: AppManifest | undefined,
  eventStore: EventStore,
): PackRuntime {
  const innerDispatch = runtime.dispatchCommand.bind(runtime);

  return {
    ...runtime,
    async dispatchCommand(command: CommandEnvelope): Promise<CommandOutcome> {
      // Validate dedupe_scope as a backstop
      const validationError = validateDedupeScope(command);
      if (validationError) {
        await emitCommandRejected(
          eventStore,
          command,
          "validation_failed",
          validationError,
        );
        return {
          command_id: command.command_id,
          status: "rejected",
          reason: validationError,
        };
      }

      const pack = runtime.getPackForCommand(command.command_type);
      if (!pack) {
        await emitCommandRejected(eventStore, command, "pack_not_loaded");
        return {
          command_id: command.command_id,
          status: "rejected",
          reason: "Pack not loaded",
        };
      }

      if (!pack.manifest.public_commands?.includes(command.command_type)) {
        await emitCommandRejected(eventStore, command, "command_not_declared");
        return {
          command_id: command.command_id,
          status: "rejected",
          reason: "Command not declared by pack",
        };
      }

      const capabilityId = command.capability_id ?? command.command_type;
      if (
        manifest?.capabilities &&
        !manifest.capabilities.includes(capabilityId)
      ) {
        await emitCommandRejected(eventStore, command, "capability_denied");
        return {
          command_id: command.command_id,
          status: "rejected",
          reason: "App lacks capability",
        };
      }

      return innerDispatch(command);
    },
  };
}

async function emitPacksLoaded(
  eventStore: EventStore,
  payload: PacksLoadedPayload,
  correlationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const event = buildHostEvent(
    HOST_EVENT_TYPES.PacksLoaded,
    payload,
    correlationId,
    now,
  );
  await eventStore.append(event);
}

async function emitLoadFailed(
  eventStore: EventStore,
  payload: PackLoadFailedPayload,
  correlationId: string,
  err?: unknown,
): Promise<void> {
  const now = new Date().toISOString();
  const errorPayload = {
    ...payload,
    error:
      payload.error ?? (err instanceof Error ? err.message : "Unknown error"),
  };
  const event = buildHostEvent(
    HOST_EVENT_TYPES.PackLoadFailed,
    errorPayload,
    correlationId,
    now,
  );
  await eventStore.append(event);
}

async function emitCommandRejected(
  eventStore: EventStore,
  command: {
    command_id: string;
    command_type: string;
    actor: { actor_id: string; actor_type: string };
    correlation_id?: string;
  },
  reason: CommandRejectedPayload["reason"],
  details?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: CommandRejectedPayload = {
    command_id: command.command_id,
    command_type: command.command_type,
    actor: command.actor,
    reason,
    ...(details ? { details } : {}),
  };
  const event = buildHostEvent(
    HOST_EVENT_TYPES.CommandRejected,
    payload,
    command.correlation_id ?? Identity.randomId(),
    now,
  );
  await eventStore.append(event);
}

function buildHostEvent<T extends string, P>(
  eventType: T,
  payload: P,
  correlationId: string,
  now: string,
) {
  return {
    event_id: Identity.generateEventId({ eventType, payload }),
    event_type: eventType,
    payload,
    occurred_at: now,
    ingested_at: now,
    correlation_id: correlationId,
    actor: { actor_id: "ops-host", actor_type: "service" as const },
    envelope_version: 1,
    payload_schema_version: 1,
  };
}
