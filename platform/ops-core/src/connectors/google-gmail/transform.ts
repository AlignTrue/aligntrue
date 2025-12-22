import type { EmailAttachmentMeta, EmailMessageRecord } from "./types.js";
import type { GmailMessage } from "./fetch.js";

export function transformGmailMessage(raw: GmailMessage): EmailMessageRecord {
  return {
    provider: "google_gmail",
    message_id: raw.id,
    thread_id: raw.threadId,
    internal_date: raw.internalDate,
    ...(raw.from !== undefined && { from: raw.from }),
    ...(raw.to !== undefined && { to: raw.to }),
    ...(raw.cc !== undefined && { cc: raw.cc }),
    ...(raw.subject !== undefined && { subject: raw.subject }),
    ...(raw.labelIds !== undefined && { label_ids: raw.labelIds }),
    ...(raw.snippet !== undefined && { snippet: raw.snippet }),
    attachments: extractAttachmentMeta(raw),
  };
}

export function transformGmailMessages(
  raw: GmailMessage[],
): EmailMessageRecord[] {
  return raw.map(transformGmailMessage);
}

function extractAttachmentMeta(_raw: GmailMessage): EmailAttachmentMeta[] {
  // For metadata-only ingest we do not fetch attachments; return empty.
  return [];
}
