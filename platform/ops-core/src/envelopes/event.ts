import { ValidationError } from "../errors.js";
import { ActorRef } from "./actor.js";
import type { CommandCausationType } from "../contracts/envelopes.js";

export interface EventEnvelope<T extends string = string, P = unknown> {
  readonly event_id: string; // deterministic
  readonly event_type: T; // namespaced
  readonly payload: P;

  // Time + causality
  readonly occurred_at: string;
  readonly ingested_at: string;
  readonly effective_at?: string;
  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;
  readonly source_ref?: string;
  readonly source_sequence?: number;

  // Actor + capability (scope derived by lookup)
  readonly actor: ActorRef;
  readonly capability_id?: string;

  // Versioning
  readonly envelope_version: number;
  readonly payload_schema_version: number;
}

const REQUIRED_EVENT_FIELDS: (keyof EventEnvelope)[] = [
  "event_id",
  "event_type",
  "payload",
  "occurred_at",
  "ingested_at",
  "correlation_id",
  "actor",
  "envelope_version",
  "payload_schema_version",
];

export function validateEventEnvelope(
  candidate: Partial<EventEnvelope>,
): EventEnvelope {
  for (const field of REQUIRED_EVENT_FIELDS) {
    if (candidate[field] === undefined) {
      throw new ValidationError(`Missing required event field: ${field}`);
    }
  }

  return candidate as EventEnvelope;
}
