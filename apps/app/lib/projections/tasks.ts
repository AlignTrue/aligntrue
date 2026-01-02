import {
  DEFAULT_TASKS_EVENTS_PATH,
  TasksProjectionDef,
  buildTasksProjectionFromState,
  type TasksProjection,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";
import { Projections } from "@aligntrue/core";
import { getEventStore, getHost } from "@/lib/ops-services";
import { computeHead, type ProjectionCache } from "./shared";

let tasksCache: ProjectionCache<TasksProjection> | null = null;

export async function readTasksProjection(): Promise<TasksProjection | null> {
  await getHost();
  const head = computeHead(DEFAULT_TASKS_EVENTS_PATH);

  if (tasksCache && tasksCache.head === head) {
    return tasksCache.data;
  }

  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );

  tasksCache = { head, data: projection };
  return projection;
}
