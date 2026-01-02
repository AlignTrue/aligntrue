import type { EventEnvelope } from "../envelopes/event.js";
import type { ResolvedPack } from "./app-manifest.js";

export const HOST_EVENT_TYPES = {
  PacksLoaded: "core.packs.loaded",
  PackLoadFailed: "core.packs.load_failed",
  CommandRejected: "core.command.rejected",
  ChildDispatched: "core.command.child_dispatched",
} as const;

/**
 * Payloads contain BUSINESS data only.
 * Time (occurred_at, ingested_at) and causality (correlation_id, causation_id)
 * are in the EventEnvelope, not repeated here.
 */

export interface PacksLoadedPayload {
  host_run_id: string; // Groups all events from this host boot
  app_name: string;
  app_version: string;
  packs_requested: Array<{ name: string; version: string; integrity?: string }>;
  packs_resolved: ResolvedPack[];
  config_hash: string;
  load_duration_ms: number;
}

export interface PackLoadFailedPayload {
  host_run_id: string;
  app_name: string;
  app_version: string;
  pack_name: string;
  requested_version: string;
  error: string;
  reason:
    | "version_mismatch"
    | "integrity_mismatch"
    | "not_found"
    | "dist_missing"
    | "load_error";
}

export interface CommandRejectedPayload {
  command_id: string;
  command_type: string;
  actor: { actor_id: string; actor_type: string };
  reason:
    | "capability_denied"
    | "pack_not_loaded"
    | "command_not_declared"
    | "validation_failed";
  details?: string;
}

export interface ChildDispatchedPayload {
  parent_command_id: string;
  parent_command_type: string;
  child_command_id: string;
  child_command_type: string;
  child_target_ref?: string;
  invoked_by_pack_id: string;
  child_idempotency_key: string;
  dedupe_scope: string;
}

// Events are EventEnvelope<type, payload> - envelope provides time + causality
export type PacksLoadedEvent = EventEnvelope<
  (typeof HOST_EVENT_TYPES)["PacksLoaded"],
  PacksLoadedPayload
>;
export type PackLoadFailedEvent = EventEnvelope<
  (typeof HOST_EVENT_TYPES)["PackLoadFailed"],
  PackLoadFailedPayload
>;
export type CommandRejectedEvent = EventEnvelope<
  (typeof HOST_EVENT_TYPES)["CommandRejected"],
  CommandRejectedPayload
>;

export type ChildDispatchedEvent = EventEnvelope<
  (typeof HOST_EVENT_TYPES)["ChildDispatched"],
  ChildDispatchedPayload
>;
