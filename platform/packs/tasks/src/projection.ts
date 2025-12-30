import type {
  ProjectionDefinition,
  ProjectionFreshness,
  EventEnvelope,
} from "@aligntrue/ops-core";
import { hashCanonical } from "@aligntrue/ops-core";
import {
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  type TaskEvent,
} from "./events.js";
import {
  initialState,
  reduceEvent,
  type TaskState,
  type TasksLedgerState,
} from "./state-machine.js";

export type TaskLatest = TaskState;

export interface TasksProjection {
  tasks: TaskLatest[];
}

export type TasksProjectionState = TasksLedgerState & ProjectionFreshness;

export const TasksProjectionDef: ProjectionDefinition<TasksProjectionState> = {
  name: "pack.tasks.latest",
  version: "1.0.0",
  init(): TasksProjectionState {
    return {
      ...initialState(),
      last_event_id: null,
      last_ingested_at: null,
    };
  },
  apply(
    state: TasksProjectionState,
    event: EventEnvelope,
  ): TasksProjectionState {
    const isTaskEvent =
      (Object.values(TASK_EVENT_TYPES) as string[]).includes(
        event.event_type,
      ) ||
      (Object.values(LEGACY_TASK_EVENT_TYPES) as string[]).includes(
        event.event_type,
      );

    if (isTaskEvent) {
      reduceEvent(state, event as TaskEvent);
      return {
        ...state,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    }
    return state;
  },
  getFreshness(state: TasksProjectionState): ProjectionFreshness {
    return {
      last_event_id: state.last_event_id,
      last_ingested_at: state.last_ingested_at,
    };
  },
};

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
