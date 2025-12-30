/**
 * Envelope contracts used by ops-core. Mirrors constitution Sections 0-2.
 * Kept in sync with runtime envelope types under src/envelopes/.
 */

import type { ActorRef } from "../envelopes/actor.js";

export type CommandCausationType =
  | "event"
  | "command"
  | "derived_artifact"
  | "user_action";

export interface EventEnvelope<T extends string = string, P = unknown> {
  readonly event_id: string; // deterministic: hash(source_ref, source_native_id, payload_hash, occurred_at)
  readonly event_type: T; // namespaced: pack.* / shared.* / core.*
  readonly payload: P;

  readonly occurred_at: string;
  readonly ingested_at: string;
  readonly effective_at?: string;

  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;

  readonly source_ref?: string;
  readonly source_sequence?: number;

  readonly actor: ActorRef;
  readonly capability_id?: string; // capability reference; scope is derived by lookup

  readonly envelope_version: number;
  readonly payload_schema_version: number;
}

export interface CommandEnvelope<T extends string = string, P = unknown> {
  readonly command_id: string; // unique per attempt
  readonly idempotency_key: string; // deterministic dedupe key
  readonly command_type: T; // namespaced: pack.* / shared.* / core.*
  readonly payload: P;

  readonly target_ref: string;
  readonly dedupe_scope: string; // typed scope string (see constitution)

  readonly expected_version?: number;
  readonly state_predicate?: string;

  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;

  readonly actor: ActorRef;
  readonly requested_at: string;
  readonly capability_id?: string;
}
