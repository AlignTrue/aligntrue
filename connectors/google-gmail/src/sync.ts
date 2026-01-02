import type { EventStore, ActorRef, DocRef } from "@aligntrue/core";
import { ValidationError, randomId, deterministicId } from "@aligntrue/core";
import { OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED } from "@aligntrue/core";
import type { EmailAttachmentMeta, EmailMessageRecord } from "./types.js";
import { buildEmailIngestEvent, deriveEmailSourceRef } from "./events.js";

export interface IngestEmailResult {
  written: number;
  skipped: number;
  disabled: boolean;
  written_records: EmailMessageRecord[];
}

export interface IngestEmailOptions {
  eventStore: EventStore;
  emails: EmailMessageRecord[];
  correlation_id?: string;
  actor?: ActorRef;
  now?: () => string;
  flagEnabled?: boolean;
}

const CONNECTOR_ACTOR: ActorRef = {
  actor_id: "google-gmail-connector",
  actor_type: "service",
  display_name: "Google Gmail Connector",
};

/**
 * Ingest Gmail messages into the event store with idempotent upsert semantics.
 * - Flag-gated via OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED (default OFF)
 * - Deterministic source_ref derived from provider + messageId + threadId + internal_date
 * - Skips duplicates by event_id (same source_ref + internal_date)
 * - Attachments are represented as DocRefs only (no blob fetch)
 */
export async function ingestEmailMessages(
  options: IngestEmailOptions,
): Promise<IngestEmailResult> {
  const {
    eventStore,
    emails,
    correlation_id = randomId(),
    actor = CONNECTOR_ACTOR,
    now = () => new Date().toISOString(),
  } = options;
  const flagEnabled = options.flagEnabled ?? OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED;

  if (!flagEnabled) {
    return {
      written: 0,
      skipped: emails.length,
      disabled: true,
      written_records: [],
    };
  }

  let written = 0;
  let skipped = 0;
  const written_records: EmailMessageRecord[] = [];

  for (const record of emails) {
    validateRecord(record);
    const ingested_at = now();
    const source_ref = deriveEmailSourceRef({
      provider: record.provider,
      message_id: record.message_id,
      thread_id: record.thread_id,
      internal_date: record.internal_date,
    });
    const doc_refs = buildDocRefs(record.attachments ?? [], source_ref);

    const event = buildEmailIngestEvent({
      record,
      correlation_id,
      ingested_at,
      actor,
      doc_refs,
    });

    const existing = await eventStore.getById(event.event_id);
    if (existing) {
      skipped += 1;
      continue;
    }

    await eventStore.append(event);
    written += 1;
    written_records.push(record);
  }

  return { written, skipped, disabled: false, written_records };
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

function buildDocRefs(
  attachments: EmailAttachmentMeta[],
  parent_ref: string,
): DocRef[] {
  return attachments.map((attachment, idx) => {
    const base = {
      provider: "google_gmail",
      provider_doc_id: attachment.attachment_id,
      parent_ref,
      attachment_idx: idx,
    };
    const doc_ref_id = deterministicId(base);

    const docRef: DocRef = {
      doc_ref_id,
      provider: "google_gmail",
      provider_doc_id: attachment.attachment_id,
      parent_ref,
    };

    if (attachment.filename) {
      docRef.filename = attachment.filename;
    }
    if (attachment.mime_type) {
      docRef.mime_type = attachment.mime_type;
    }
    if (attachment.size_bytes !== undefined) {
      docRef.size_bytes = attachment.size_bytes;
    }

    return docRef;
  });
}

export { deriveEmailSourceRef };
