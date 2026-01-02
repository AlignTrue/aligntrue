import type { ActorRef, EventEnvelope, DocRef } from "@aligntrue/core";
import {
  generateEventId,
  hashCanonical,
  ValidationError,
} from "@aligntrue/core";
import type { EmailMessageRecord } from "./types.js";

const GMAIL_ENVELOPE_VERSION = 1;
const GMAIL_PAYLOAD_SCHEMA_VERSION = 1;

export const EMAIL_EVENT_TYPES = {
  EmailMessageIngested: "email_message_ingested",
} as const;

export type EmailEventType =
  (typeof EMAIL_EVENT_TYPES)[keyof typeof EMAIL_EVENT_TYPES];

export interface EmailMessageIngestedPayload {
  source_ref: string;
  provider: EmailMessageRecord["provider"];
  message_id: string;
  thread_id: string;
  internal_date: string;
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  label_ids?: string[];
  snippet?: string;
  doc_refs?: DocRef[];
  history_id?: string;
}

export type EmailEventEnvelope = EventEnvelope<
  (typeof EMAIL_EVENT_TYPES)["EmailMessageIngested"],
  EmailMessageIngestedPayload
>;

export function deriveEmailSourceRef(input: {
  provider: string;
  message_id: string;
  thread_id: string;
  internal_date: string;
}): string {
  return hashCanonical(input);
}

export function buildEmailIngestEvent(opts: {
  record: EmailMessageRecord;
  correlation_id: string;
  ingested_at: string;
  actor: ActorRef;
  capability_scope?: string[];
  doc_refs?: DocRef[];
  capability_id?: string;
}): EmailEventEnvelope {
  const { record, correlation_id, ingested_at, actor } = opts;
  const capability_id =
    opts.capability_id ??
    opts.capability_scope?.[0] ??
    "connector:google_gmail";

  validateRecord(record);

  const source_ref = deriveEmailSourceRef({
    provider: record.provider,
    message_id: record.message_id,
    thread_id: record.thread_id,
    internal_date: record.internal_date,
  });

  const payload: EmailMessageIngestedPayload = {
    source_ref,
    provider: record.provider,
    message_id: record.message_id,
    thread_id: record.thread_id,
    internal_date: record.internal_date,
    ...(record.from ? { from: record.from } : {}),
    ...(record.to?.length ? { to: record.to } : {}),
    ...(record.cc?.length ? { cc: record.cc } : {}),
    ...(record.subject ? { subject: record.subject } : {}),
    ...(record.label_ids?.length ? { label_ids: record.label_ids } : {}),
    ...(record.snippet ? { snippet: record.snippet } : {}),
    ...(record.history_id ? { history_id: record.history_id } : {}),
  };

  if (opts.doc_refs?.length) {
    payload.doc_refs = opts.doc_refs;
  }

  const eventBase = {
    event_id: generateEventId({
      event_type: EMAIL_EVENT_TYPES.EmailMessageIngested,
      source_ref,
      updated: record.internal_date,
    }),
    event_type: EMAIL_EVENT_TYPES.EmailMessageIngested,
    payload,
    occurred_at: record.internal_date,
    ingested_at,
    correlation_id,
    source_ref,
    actor,
    capability_id,
    envelope_version: GMAIL_ENVELOPE_VERSION,
    payload_schema_version: GMAIL_PAYLOAD_SCHEMA_VERSION,
  };

  return eventBase;
}

function validateRecord(record: EmailMessageRecord): void {
  if (!record.provider) {
    throw new ValidationError("provider is required");
  }
  if (!record.message_id) {
    throw new ValidationError("message_id is required");
  }
  if (!record.thread_id) {
    throw new ValidationError("thread_id is required");
  }
  if (!record.internal_date) {
    throw new ValidationError("internal_date is required");
  }
}
