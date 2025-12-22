import { ValidationError } from "../errors.js";
import { ActorRef } from "./actor.js";

export interface EventEnvelope<T extends string = string, P = unknown> {
  readonly event_id: string;
  readonly event_type: T;
  readonly payload: P;

  // Time + causality
  readonly occurred_at: string;
  readonly ingested_at: string;
  readonly effective_at?: string;
  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly source_ref?: string;

  // Actor + auth
  readonly actor: ActorRef;
  readonly capability_scope: string[];

  // Versioning
  readonly schema_version: number;
}

const REQUIRED_EVENT_FIELDS: (keyof EventEnvelope)[] = [
  "event_id",
  "event_type",
  "payload",
  "occurred_at",
  "ingested_at",
  "correlation_id",
  "actor",
  "capability_scope",
  "schema_version",
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
