import {
  DEFAULT_NOTES_EVENTS_PATH,
  NotesProjectionDef,
  buildNotesProjectionFromState,
  type NotesProjection,
  type NotesProjectionState,
} from "@aligntrue/pack-notes";
import { getEventStore, getHost } from "@/lib/ops-services";
import { createCachedProjectionReader } from "./shared";

const readNotes = createCachedProjectionReader<
  NotesProjection,
  NotesProjectionState
>({
  def: NotesProjectionDef,
  build: buildNotesProjectionFromState,
  eventsPath: DEFAULT_NOTES_EVENTS_PATH,
  getEventStore,
  beforeRead: getHost,
});

export async function readNotesProjection(): Promise<NotesProjection | null> {
  return readNotes();
}
