export interface DocRef {
  doc_ref_id: string; // deterministic hash for attachment reference
  provider: string; // e.g., "google_gmail"
  provider_doc_id: string; // provider attachment id
  parent_ref: string; // source_ref of parent message
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
}
