import {
  hashCanonical,
  type ProjectionDefinition,
  type ProjectionFreshness,
  type EventEnvelope,
} from "@aligntrue/ops-core";
import {
  NOTE_EVENT_TYPES,
  LEGACY_NOTE_EVENT_TYPES,
  type NoteEvent,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type NotePatchedPayload,
} from "./events.js";

export const NOTE_PROJECTION = "pack.notes.latest" as const;

export interface NoteLatest {
  id: string;
  title: string;
  body_md: string;
  content_hash: string;
  source_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface NotesProjection {
  notes: NoteLatest[];
}

export interface NotesProjectionState extends ProjectionFreshness {
  notes: Map<string, NoteLatest>;
}

export const NotesProjectionDef: ProjectionDefinition<NotesProjectionState> = {
  name: NOTE_PROJECTION,
  version: "1.0.0",
  init(): NotesProjectionState {
    return {
      notes: new Map(),
      last_event_id: null,
      last_ingested_at: null,
    };
  },
  apply(
    state: NotesProjectionState,
    event: EventEnvelope,
  ): NotesProjectionState {
    switch (event.event_type) {
      case NOTE_EVENT_TYPES.NoteCreated:
      case NOTE_EVENT_TYPES.NoteUpdated:
      case NOTE_EVENT_TYPES.NotePatched:
      case LEGACY_NOTE_EVENT_TYPES.NoteCreated:
      case LEGACY_NOTE_EVENT_TYPES.NoteUpdated:
      case LEGACY_NOTE_EVENT_TYPES.NotePatched: {
        const noteEvent = event as NoteEvent;
        const payload = noteEvent.payload as { note_id: string };
        const noteId = payload.note_id;
        const next = new Map(state.notes);
        const existing = next.get(noteId);

        if (
          noteEvent.event_type === NOTE_EVENT_TYPES.NoteCreated ||
          noteEvent.event_type === LEGACY_NOTE_EVENT_TYPES.NoteCreated
        ) {
          const createPayload = noteEvent.payload as NoteCreatedPayload;
          next.set(noteId, {
            id: noteId,
            title: createPayload.title,
            body_md: createPayload.body_md,
            content_hash: createPayload.content_hash,
            ...(createPayload.source_ref !== undefined
              ? { source_ref: createPayload.source_ref }
              : {}),
            created_at: noteEvent.occurred_at,
            updated_at: noteEvent.ingested_at,
          });
        } else if (existing) {
          next.set(noteId, applyNoteUpdate(existing, noteEvent));
        }

        return {
          notes: next,
          last_event_id: noteEvent.event_id,
          last_ingested_at: noteEvent.ingested_at,
        };
      }
      default:
        return state;
    }
  },
  getFreshness(state: NotesProjectionState): ProjectionFreshness {
    return {
      last_event_id: state.last_event_id,
      last_ingested_at: state.last_ingested_at,
    };
  },
};

function applyNoteUpdate(existing: NoteLatest, event: NoteEvent): NoteLatest {
  switch (event.event_type) {
    case NOTE_EVENT_TYPES.NoteUpdated:
    case LEGACY_NOTE_EVENT_TYPES.NoteUpdated: {
      const payload = event.payload as NoteUpdatedPayload;
      const next: NoteLatest = { ...existing, updated_at: event.ingested_at };

      if (payload.title !== undefined) next.title = payload.title;
      if (payload.body_md !== undefined) next.body_md = payload.body_md;
      if (payload.content_hash !== undefined)
        next.content_hash = payload.content_hash;
      if (payload.source_ref !== undefined)
        next.source_ref = payload.source_ref;

      return next;
    }
    case NOTE_EVENT_TYPES.NotePatched:
    case LEGACY_NOTE_EVENT_TYPES.NotePatched: {
      const payload = event.payload as NotePatchedPayload;
      return {
        ...existing,
        body_md: payload.body_md,
        content_hash: payload.content_hash,
        updated_at: event.ingested_at,
      };
    }
    default:
      return existing;
  }
}

export function buildNotesProjectionFromState(
  state: NotesProjectionState,
): NotesProjection {
  const notes = Array.from(state.notes.values()).sort((a, b) => {
    if (a.updated_at === b.updated_at) {
      return a.id.localeCompare(b.id);
    }
    return a.updated_at > b.updated_at ? -1 : 1;
  });
  return { notes };
}

export function hashNotesProjection(projection: NotesProjection): string {
  return hashCanonical(projection);
}
