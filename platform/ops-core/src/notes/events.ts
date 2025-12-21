import type { EventEnvelope } from "../envelopes/index.js";

export const NOTES_SCHEMA_VERSION = 1;

export const NOTE_EVENT_TYPES = {
  NoteCreated: "note_created",
  NoteUpdated: "note_updated",
  NotePatched: "note_patched",
} as const;

export type NoteEventType =
  (typeof NOTE_EVENT_TYPES)[keyof typeof NOTE_EVENT_TYPES];

export interface NoteCreatedPayload {
  note_id: string;
  title: string;
  body_md: string;
  content_hash: string;
  source_ref?: string;
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

export type NoteEvent =
  | EventEnvelope<typeof NOTE_EVENT_TYPES.NoteCreated, NoteCreatedPayload>
  | EventEnvelope<typeof NOTE_EVENT_TYPES.NoteUpdated, NoteUpdatedPayload>
  | EventEnvelope<typeof NOTE_EVENT_TYPES.NotePatched, NotePatchedPayload>;
