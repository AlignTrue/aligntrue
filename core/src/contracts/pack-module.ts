import type { EventEnvelope } from "../envelopes/event.js";
import type { PackManifest } from "./pack-manifest.js";
import type { ProjectionDefinition } from "../projections/definition.js";
import type {
  EventStore,
  CommandLog,
  ArtifactStore,
} from "../storage/interfaces.js";
import type { ProjectionRegistry } from "../projections/registry.js";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/command.js";

/**
 * Contract that all packs must implement.
 * Packs provide a manifest plus optional handlers, projections, and lifecycle hooks.
 */
export interface PackModule {
  readonly manifest: PackManifest;
  readonly handlers?: Record<string, PackEventHandler>;
  readonly commandHandlers?: Record<string, PackCommandHandler>;
  readonly projections?: ProjectionDefinition<unknown>[];
  init?(context: PackContext): Promise<void>;
  /**
   * Optional hook to extend the pack context with pack-specific dependencies.
   * Called for every handler invocation; implementers should reuse singletons.
   */
  extendContext?(
    base: PackContext,
    opts?: {
      packId: string;
      parentCommand?: CommandEnvelope;
      childCommands?: string[];
    },
  ): PackContext;
  dispose?(): Promise<void>;
}

export interface PackEventHandler {
  (event: EventEnvelope, context: PackContext): Promise<void>;
}

export interface PackCommandHandler {
  (
    command: CommandEnvelope,
    context: PackContext,
  ): Promise<CommandOutcome | void>;
}

export interface PackContext {
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly projectionRegistry: ProjectionRegistry;
  readonly config: Record<string, unknown>;
  readonly artifactStore?: ArtifactStore<unknown, unknown>;
  readonly feedbackEventStore?: EventStore;
  readonly suggestionEventStore?: EventStore;
  dispatchChild: (
    command: Omit<
      CommandEnvelope,
      | "actor"
      | "correlation_id"
      | "causation_id"
      | "command_id"
      | "idempotency_key"
      | "requested_at"
    > &
      Partial<Pick<CommandEnvelope, "command_id" | "idempotency_key">>,
  ) => Promise<CommandOutcome>;
}
