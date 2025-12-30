import type { EventEnvelope } from "../envelopes/event.js";
import type { PackManifest } from "./pack-manifest.js";
import type { ProjectionDefinition } from "../projections/definition.js";
import type { EventStore, CommandLog } from "../storage/interfaces.js";
import type { ProjectionRegistry } from "../projections/registry.js";

/**
 * Contract that all packs must implement.
 * Packs provide a manifest plus optional handlers, projections, and lifecycle hooks.
 */
export interface PackModule {
  readonly manifest: PackManifest;
  readonly handlers?: Record<string, PackEventHandler>;
  readonly projections?: ProjectionDefinition<unknown>[];
  init?(context: PackContext): Promise<void>;
  dispose?(): Promise<void>;
}

export interface PackEventHandler {
  (event: EventEnvelope, context: PackContext): Promise<void>;
}

export interface PackContext {
  readonly eventStore: EventStore;
  readonly commandLog: CommandLog;
  readonly projectionRegistry: ProjectionRegistry;
  readonly config: Record<string, unknown>;
}
