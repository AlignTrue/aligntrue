import fs from "node:fs";
import {
  DEFAULT_NOTES_EVENTS_PATH,
  NotesProjectionDef,
  buildNotesProjectionFromState,
  type NotesProjection,
  type NotesProjectionState,
} from "@aligntrue/pack-notes";
import { Projections } from "@aligntrue/ops-core";
import { getEventStore, getHost } from "@/lib/ops-services";

interface ProjectionCache<T> {
  head: string | null;
  data: T;
}

let notesCache: ProjectionCache<NotesProjection> | null = null;

function computeHead(path: string): string | null {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stat = fs.statSync(path);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

export async function readNotesProjection(): Promise<NotesProjection | null> {
  await getHost();
  const head = computeHead(DEFAULT_NOTES_EVENTS_PATH);

  if (notesCache && notesCache.head === head) {
    return notesCache.data;
  }

  const rebuilt = await Projections.rebuildOne(
    NotesProjectionDef,
    getEventStore(DEFAULT_NOTES_EVENTS_PATH),
  );
  const projection = buildNotesProjectionFromState(
    rebuilt.data as NotesProjectionState,
  );

  notesCache = { head, data: projection };
  return projection;
}
