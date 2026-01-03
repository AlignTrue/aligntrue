import {
  OPS_NOTES_ENABLED,
  OPS_TASKS_ENABLED,
  Projections,
} from "@aligntrue/core";
import {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  DEFAULT_TASKS_EVENTS_PATH,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";
import * as PackNotes from "@aligntrue/pack-notes";

import { getEventStore, getHost } from "@/lib/ops-services";

export async function getTasksView() {
  if (!OPS_TASKS_ENABLED) return null;
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  return {
    projection,
    hash: hashTasksProjection(projection),
  };
}

export async function getNotesView() {
  if (!OPS_NOTES_ENABLED) return null;
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    PackNotes.NotesProjectionDef,
    getEventStore(),
  );
  return PackNotes.buildNotesProjectionFromState(
    rebuilt.data as PackNotes.NotesProjectionState,
  );
}
