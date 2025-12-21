export type GmailMutationOp = "APPLY_LABEL" | "ARCHIVE";

export interface GmailMutationRequest {
  mutation_id: string;
  provider: "google_gmail";
  message_id: string;
  thread_id: string;
  operations: GmailMutationOp[];
  label_id?: string;
}

export interface GmailMutationReceipt {
  mutation_id: string;
  operation: GmailMutationOp;
  approved: boolean;
  reason?: string;
  destination_ref?: string;
  completed_at?: string;
}
