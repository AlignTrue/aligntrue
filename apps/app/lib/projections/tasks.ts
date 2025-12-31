import fs from "node:fs";
import {
  DEFAULT_TASKS_EVENTS_PATH,
  TasksProjectionDef,
  buildTasksProjectionFromState,
  type TasksProjection,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";
import { Projections } from "@aligntrue/ops-core";
import { getEventStore, getHost } from "@/lib/ops-services";

interface ProjectionCache<T> {
  head: string | null;
  data: T;
}

let tasksCache: ProjectionCache<TasksProjection> | null = null;

function computeHead(path: string): string | null {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stat = fs.statSync(path);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

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
