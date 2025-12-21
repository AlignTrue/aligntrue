import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/index.js";
import { hashCanonical } from "../identity/hash.js";
import {
  TASK_EVENT_TYPES,
  type TaskEvent,
  type TaskTriagedPayload,
} from "../tasks/events.js";
import type {
  TaskBucket,
  TaskEffort,
  TaskImpact,
  TaskStatus,
} from "../tasks/types.js";

export interface TaskLatest {
  id: string;
  title: string;
  bucket: TaskBucket;
  status: TaskStatus;
  impact?: TaskImpact;
  effort?: TaskEffort;
  due_at?: string | null;
  source_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface TasksProjection {
  tasks: TaskLatest[];
}

export interface TasksProjectionState extends ProjectionFreshness {
  tasks: Map<string, TaskLatest>;
}

export const TasksProjectionDef: ProjectionDefinition<TasksProjectionState> = {
  name: "task_latest",
  version: "1.0.0",
  init(): TasksProjectionState {
    return {
      tasks: new Map(),
      last_event_id: null,
      last_ingested_at: null,
    };
  },
  apply(
    state: TasksProjectionState,
    event: EventEnvelope,
  ): TasksProjectionState {
    switch (event.event_type) {
      case TASK_EVENT_TYPES.TaskCreated:
      case TASK_EVENT_TYPES.TaskTriaged:
      case TASK_EVENT_TYPES.TaskCompleted:
      case TASK_EVENT_TYPES.TaskReopened: {
        const taskEvent = event as TaskEvent;
        const next = new Map(state.tasks);
        const existing = next.get(taskEvent.payload.task_id);

        if (taskEvent.event_type === TASK_EVENT_TYPES.TaskCreated) {
          next.set(taskEvent.payload.task_id, {
            id: taskEvent.payload.task_id,
            title: taskEvent.payload.title,
            bucket: taskEvent.payload.bucket,
            status: taskEvent.payload.status,
            ...(taskEvent.payload.impact !== undefined
              ? { impact: taskEvent.payload.impact }
              : {}),
            ...(taskEvent.payload.effort !== undefined
              ? { effort: taskEvent.payload.effort }
              : {}),
            due_at: taskEvent.payload.due_at ?? null,
            ...(taskEvent.payload.source_ref !== undefined
              ? { source_ref: taskEvent.payload.source_ref }
              : {}),
            created_at: taskEvent.occurred_at,
            updated_at: taskEvent.ingested_at,
          });
        } else if (existing) {
          next.set(
            taskEvent.payload.task_id,
            applyTaskUpdate(existing, taskEvent as TaskEvent),
          );
        }

        return {
          tasks: next,
          last_event_id: taskEvent.event_id,
          last_ingested_at: taskEvent.ingested_at,
        };
      }
      default:
        return state;
    }
  },
  getFreshness(state: TasksProjectionState): ProjectionFreshness {
    return {
      last_event_id: state.last_event_id,
      last_ingested_at: state.last_ingested_at,
    };
  },
};

function applyTaskUpdate(existing: TaskLatest, event: TaskEvent): TaskLatest {
  switch (event.event_type) {
    case TASK_EVENT_TYPES.TaskTriaged: {
      const payload = event.payload as TaskTriagedPayload;
      const next: TaskLatest = { ...existing, updated_at: event.ingested_at };

      if (payload.title !== undefined) next.title = payload.title;
      if (payload.bucket !== undefined) next.bucket = payload.bucket;
      if (payload.impact !== undefined) next.impact = payload.impact;
      if (payload.effort !== undefined) next.effort = payload.effort;
      if (payload.due_at !== undefined) next.due_at = payload.due_at ?? null;

      return next;
    }
    case TASK_EVENT_TYPES.TaskCompleted:
      return {
        ...existing,
        status: "completed",
        updated_at: event.ingested_at,
      };
    case TASK_EVENT_TYPES.TaskReopened:
      return { ...existing, status: "open", updated_at: event.ingested_at };
    default:
      return existing;
  }
}

export function buildTasksProjectionFromState(
  state: TasksProjectionState,
): TasksProjection {
  const tasks = Array.from(state.tasks.values()).sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "open" ? -1 : 1;
    }
    if (a.updated_at === b.updated_at) {
      return a.id.localeCompare(b.id);
    }
    return a.updated_at > b.updated_at ? -1 : 1;
  });
  return { tasks };
}

export function hashTasksProjection(projection: TasksProjection): string {
  return hashCanonical(projection);
}
