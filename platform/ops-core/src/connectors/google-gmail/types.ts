export interface EmailAttachmentMeta {
  attachment_id: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface EmailMessageRecord {
  provider: "google_gmail";
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

export interface GmailCursorState {
  cursor: string | null;
  lastSyncedAt?: string;
}
