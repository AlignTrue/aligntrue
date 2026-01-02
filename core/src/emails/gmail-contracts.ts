import type { EventEnvelope } from "../envelopes/event.js";
import type { DocRef } from "../docrefs/index.js";

export const EMAIL_EVENT_TYPES = {
  EmailMessageIngested: "email_message_ingested",
} as const;

export interface EmailMessageIngestedPayload {
  source_ref: string;
  provider: string;
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

export interface EmailAttachmentMeta {
  attachment_id: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface EmailMessageRecord {
  provider: string;
  message_id: string;
  thread_id: string;
  internal_date: string; // source occurred_at
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  label_ids?: string[];
  snippet?: string;
  attachments?: EmailAttachmentMeta[];
  history_id?: string;
}

export type EmailEventEnvelope = EventEnvelope<
  (typeof EMAIL_EVENT_TYPES)["EmailMessageIngested"],
  EmailMessageIngestedPayload
>;

export const GMAIL_MUTATION_EVENT_TYPES = {
  GmailMutationRequested: "gmail_mutation_requested",
  GmailMutationAttempted: "gmail_mutation_attempted",
  GmailMutationSucceeded: "gmail_mutation_succeeded",
  GmailMutationFailed: "gmail_mutation_failed",
} as const;
