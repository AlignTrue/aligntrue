import type { EventEnvelope } from "@aligntrue/ops-core";
import { generateEventId } from "@aligntrue/ops-core";
import type { GmailMutationOp } from "./types.js";

const GMAIL_MUTATION_ENVELOPE_VERSION = 1;

export const GMAIL_MUTATION_SCHEMA_VERSION = 1;

export const GMAIL_MUTATION_EVENT_TYPES = {
  GmailMutationRequested: "gmail_mutation_requested",
  GmailMutationAttempted: "gmail_mutation_attempted",
  GmailMutationSucceeded: "gmail_mutation_succeeded",
  GmailMutationFailed: "gmail_mutation_failed",
} as const;

export type GmailMutationEventType =
  (typeof GMAIL_MUTATION_EVENT_TYPES)[keyof typeof GMAIL_MUTATION_EVENT_TYPES];

export interface GmailMutationRequestedPayload {
  mutation_id: string;
  provider: "google_gmail";
  message_id: string;
  thread_id: string;
  operations: GmailMutationOp[];
  label_id?: string;
}

export interface GmailMutationAttemptedPayload {
  mutation_id: string;
  operation: GmailMutationOp;
  provider: "google_gmail";
  message_id: string;
  thread_id: string;
  label_id?: string;
  requested_at?: string;
}

export interface GmailMutationSucceededPayload {
  mutation_id: string;
  operation: GmailMutationOp;
  provider: "google_gmail";
  message_id: string;
  thread_id: string;
  label_id?: string;
  destination_ref?: string;
  completed_at?: string;
}

export interface GmailMutationFailedPayload {
  mutation_id: string;
  operation: GmailMutationOp;
  provider: "google_gmail";
  message_id: string;
  thread_id: string;
  label_id?: string;
  reason: string;
  completed_at?: string;
}

export type GmailMutationEvent =
  | EventEnvelope<
      (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationRequested"],
      GmailMutationRequestedPayload
    >
  | EventEnvelope<
      (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationAttempted"],
      GmailMutationAttemptedPayload
    >
  | EventEnvelope<
      (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationSucceeded"],
      GmailMutationSucceededPayload
    >
  | EventEnvelope<
      (typeof GMAIL_MUTATION_EVENT_TYPES)["GmailMutationFailed"],
      GmailMutationFailedPayload
    >;

export function buildMutationEvent<TPayload>(
  event_type: GmailMutationEvent["event_type"],
  payload: TPayload,
  opts: {
    occurred_at: string;
    ingested_at: string;
    correlation_id: string;
    causation_id: string;
    source_ref?: string;
    actor?: GmailMutationEvent["actor"];
    capability_scope?: string[];
    capability_id?: string;
  },
): GmailMutationEvent {
  const capability_id = opts.capability_id ?? opts.capability_scope?.[0];
  return {
    event_id: generateEventId({ event_type, payload }),
    event_type,
    payload,
    occurred_at: opts.occurred_at,
    ingested_at: opts.ingested_at,
    correlation_id: opts.correlation_id,
    causation_id: opts.causation_id,
    source_ref: opts.source_ref,
    actor: opts.actor,
    ...(capability_id !== undefined ? { capability_id } : {}),
    envelope_version: GMAIL_MUTATION_ENVELOPE_VERSION,
    payload_schema_version: GMAIL_MUTATION_SCHEMA_VERSION,
  } as GmailMutationEvent;
}
