import {
  DEFAULT_TASKS_EVENTS_PATH,
  TasksProjectionDef,
  buildTasksProjectionFromState,
  type TasksProjection,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";
import { getEventStore, getHost } from "@/lib/ops-services";
import { createCachedProjectionReader } from "./shared";

const readTasks = createCachedProjectionReader<
  TasksProjection,
  TasksProjectionState
>({
  def: TasksProjectionDef,
  build: buildTasksProjectionFromState,
  eventsPath: DEFAULT_TASKS_EVENTS_PATH,
  getEventStore,
  beforeRead: getHost,
});

export async function readTasksProjection(): Promise<TasksProjection | null> {
  return readTasks();
}
