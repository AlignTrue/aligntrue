import type { PackModule } from "@aligntrue/core";
import { manifest } from "./manifest.js";
import { commandHandlers } from "./commands.js";
import {
  NotesProjectionDef,
  buildNotesProjectionFromState,
  hashNotesProjection,
} from "./projection.js";
import {
  NoteLedger,
  createJsonlNoteLedger,
  DEFAULT_NOTES_EVENTS_PATH,
  type NoteCommandEnvelope,
  type NoteCommandPayload,
  type NoteCommandType,
} from "./ledger.js";
import {
  NOTE_EVENT_TYPES,
  LEGACY_NOTE_EVENT_TYPES,
  NOTES_SCHEMA_VERSION,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NotePatchedPayload,
  type NoteEvent,
} from "./events.js";
import {
  NotesProjection,
  NotesProjectionState,
  NoteLatest,
} from "./projection.js";
import { Contracts } from "@aligntrue/core";

const moduleImpl: PackModule = {
  manifest,
  commandHandlers,
  projections: [NotesProjectionDef],
};

export default moduleImpl;
export { manifest } from "./manifest.js";
export { commandHandlers } from "./commands.js";
export {
  NoteLedger,
  createJsonlNoteLedger,
  DEFAULT_NOTES_EVENTS_PATH,
  NotesProjectionDef,
  buildNotesProjectionFromState,
  hashNotesProjection,
  NOTE_EVENT_TYPES,
  LEGACY_NOTE_EVENT_TYPES,
  NOTES_SCHEMA_VERSION,
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NotePatchedPayload,
  NoteEvent,
  NotesProjection,
  NotesProjectionState,
  NoteLatest,
  NoteCommandEnvelope,
  NoteCommandPayload,
  NoteCommandType,
};
export const { NOTE_COMMAND_TYPES } = Contracts;
export { NOTE_PROJECTION } from "./projection.js";
