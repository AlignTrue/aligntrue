import {
  NOTE_EVENT_TYPES,
  LEGACY_NOTE_EVENT_TYPES,
  type NoteEvent,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NotePatchedPayload,
} from "./events.js";

export interface NoteState {
  id: string;
  title: string;
  body_md: string;
  content_hash: string;
  source_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface NotesLedgerState {
  notes: Map<string, NoteState>;
}

export function initialState(): NotesLedgerState {
  return { notes: new Map() };
}

export function reduceEvent(
  state: NotesLedgerState,
  event: NoteEvent,
): NotesLedgerState {
  const next = state;
  switch (event.event_type) {
    case NOTE_EVENT_TYPES.NoteCreated:
    case LEGACY_NOTE_EVENT_TYPES.NoteCreated: {
      const payload = event.payload as NoteCreatedPayload;
      const { note_id, title, body_md, content_hash, source_ref } = payload;
      next.notes.set(note_id, {
        id: note_id,
        title,
        body_md,
        content_hash,
        ...(source_ref !== undefined ? { source_ref } : {}),
        created_at: event.occurred_at,
        updated_at: event.ingested_at,
      });
      break;
    }
    case NOTE_EVENT_TYPES.NoteUpdated:
    case LEGACY_NOTE_EVENT_TYPES.NoteUpdated: {
      const payload = event.payload as NoteUpdatedPayload;
      const { note_id, title, body_md, content_hash, source_ref } = payload;
      const existing = next.notes.get(note_id);
      if (!existing) break;
      if (title !== undefined) existing.title = title;
      if (body_md !== undefined) existing.body_md = body_md;
      if (content_hash !== undefined) existing.content_hash = content_hash;
      if (source_ref !== undefined) existing.source_ref = source_ref;
      existing.updated_at = event.ingested_at;
      break;
    }
    case NOTE_EVENT_TYPES.NotePatched:
    case LEGACY_NOTE_EVENT_TYPES.NotePatched: {
      const payload = event.payload as NotePatchedPayload;
      const { note_id, body_md, content_hash } = payload;
      const existing = next.notes.get(note_id);
      if (!existing) break;
      existing.body_md = body_md;
      existing.content_hash = content_hash;
      existing.updated_at = event.ingested_at;
      break;
    }
    default:
      break;
  }
  return next;
}

export function cloneState(state: NotesLedgerState): NotesLedgerState {
  const notes = new Map<string, NoteState>();
  for (const [id, note] of state.notes.entries()) {
    notes.set(id, { ...note });
  }
  return { notes };
}
