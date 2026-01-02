/**
 * Note domain contracts.
 * Types and constants only - no implementation.
 *
 * STABILITY RULE: Event/command type strings are append-only.
 * - File moves do NOT change type strings
 * - Projection reducers MUST handle historical versions (LEGACY_*)
 * - New event types add to the list, never modify existing
 */

export const NOTE_EVENT_TYPES = {
  NoteCreated: "pack.notes.note_created",
  NoteUpdated: "pack.notes.note_updated",
  NotePatched: "pack.notes.note_patched",
} as const;

export const LEGACY_NOTE_EVENT_TYPES = {
  NoteCreated: "note_created",
  NoteUpdated: "note_updated",
  NotePatched: "note_patched",
} as const;

export type NoteEventType =
  | (typeof NOTE_EVENT_TYPES)[keyof typeof NOTE_EVENT_TYPES]
  | (typeof LEGACY_NOTE_EVENT_TYPES)[keyof typeof LEGACY_NOTE_EVENT_TYPES];

export const NOTE_COMMAND_TYPES = {
  Create: "pack.notes.create",
  Update: "pack.notes.update",
  PatchCheckbox: "pack.notes.patch_checkbox",
} as const;

export type NoteCommandType =
  (typeof NOTE_COMMAND_TYPES)[keyof typeof NOTE_COMMAND_TYPES];

export type NoteCommandPayload =
  | NoteCreatedPayload
  | NoteUpdatedPayload
  | { note_id: string; line_index: number };

export interface NoteCreatedPayload {
  note_id: string;
  title: string;
  body_md: string;
  content_hash: string;
  source_ref?: string;
  conversion?: import("../types/conversion.js").ConversionMeta;
}

export interface NoteUpdatedPayload {
  note_id: string;
  title?: string;
  body_md?: string;
  content_hash?: string;
  source_ref?: string;
}

export interface NotePatchedPayload {
  note_id: string;
  body_md: string;
  content_hash: string;
  patch: {
    line_index: number;
    before: string;
    after: string;
  };
}
