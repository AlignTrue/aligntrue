import {
  NotesProjectionDef,
  buildNotesProjectionFromState,
  type NotesProjection,
  type NotesProjectionState,
} from "@aligntrue/pack-notes";
import { DEFAULT_EVENTS_PATH, Projections } from "@aligntrue/ops-core";
import { getEventStore, getHost } from "@/lib/ops-services";
import { computeHead, type ProjectionCache } from "./shared";

let notesCache: ProjectionCache<NotesProjection> | null = null;

export async function readNotesProjection(): Promise<NotesProjection | null> {
  await getHost();
  const head = computeHead(DEFAULT_EVENTS_PATH);

  if (notesCache && notesCache.head === head) {
    return notesCache.data;
  }

  const rebuilt = await Projections.rebuildOne(
    NotesProjectionDef,
    getEventStore(),
  );
  const projection = buildNotesProjectionFromState(
    rebuilt.data as NotesProjectionState,
  );

  notesCache = { head, data: projection };
  return projection;
}
