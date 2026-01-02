/**
 * Convert domain contracts.
 * Command/event type strings only. No implementation here.
 */

export const CONVERT_COMMAND_TYPES = {
  EmailToTask: "pack.convert.email_to_task",
  EmailToNote: "pack.convert.email_to_note",
} as const;

export type ConvertCommandType =
  (typeof CONVERT_COMMAND_TYPES)[keyof typeof CONVERT_COMMAND_TYPES];

export interface ConvertEmailToTaskPayload {
  message_id?: string;
  source_ref?: string;
  title?: string;
  conversion_method: "user_action" | "suggestion" | "rule";
}

export interface ConvertEmailToNotePayload {
  message_id?: string;
  source_ref?: string;
  title?: string;
  body_md?: string;
  conversion_method: "user_action" | "suggestion" | "rule";
}

export type ConvertCommandPayload =
  | ConvertEmailToTaskPayload
  | ConvertEmailToNotePayload;
