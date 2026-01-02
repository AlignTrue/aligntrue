import type { EventEnvelope } from "@aligntrue/core";
import {
  NOTE_EVENT_TYPES,
  LEGACY_NOTE_EVENT_TYPES,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NotePatchedPayload,
  type NoteEventType,
} from "@aligntrue/core/contracts/notes";

export const NOTES_SCHEMA_VERSION = 1;

export type NoteEvent =
  | EventEnvelope<
      (typeof NOTE_EVENT_TYPES)[keyof typeof NOTE_EVENT_TYPES],
      NoteCreatedPayload | NoteUpdatedPayload | NotePatchedPayload
    >
  | EventEnvelope<
      (typeof LEGACY_NOTE_EVENT_TYPES)[keyof typeof LEGACY_NOTE_EVENT_TYPES],
      NoteCreatedPayload | NoteUpdatedPayload | NotePatchedPayload
    >;

export { NOTE_EVENT_TYPES, LEGACY_NOTE_EVENT_TYPES };
export type {
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NotePatchedPayload,
  NoteEventType,
};
