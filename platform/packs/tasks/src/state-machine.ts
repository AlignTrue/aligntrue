import {
  TASK_EVENT_TYPES,
  LEGACY_TASK_EVENT_TYPES,
  type TaskEvent,
} from "./events.js";
import type {
  TaskBucket,
  TaskEffort,
  TaskImpact,
  TaskStatus,
} from "@aligntrue/ops-core/contracts/tasks";

export interface TaskState {
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

export interface TasksLedgerState {
  tasks: Map<string, TaskState>;
}

export function initialState(): TasksLedgerState {
  return { tasks: new Map() };
}

export function reduceEvent(
  state: TasksLedgerState,
  event: TaskEvent,
): TasksLedgerState {
  const next = state;
  switch (event.event_type) {
    case TASK_EVENT_TYPES.TaskCreated:
    case LEGACY_TASK_EVENT_TYPES.TaskCreated: {
      const {
        task_id,
        title,
        bucket,
        impact,
        effort,
        due_at,
        status,
        source_ref,
      } = event.payload;
      next.tasks.set(task_id, {
        id: task_id,
        title,
        bucket,
        status,
        due_at: due_at ?? null,
        ...(impact !== undefined ? { impact } : {}),
        ...(effort !== undefined ? { effort } : {}),
        ...(source_ref !== undefined ? { source_ref } : {}),
        created_at: event.occurred_at,
        updated_at: event.ingested_at,
      });
      break;
    }
    case TASK_EVENT_TYPES.TaskTriaged:
    case LEGACY_TASK_EVENT_TYPES.TaskTriaged: {
      const { task_id, bucket, impact, effort, due_at, title } = event.payload;
      const existing = next.tasks.get(task_id);
      if (!existing) break;
      if (bucket !== undefined) existing.bucket = bucket;
      if (impact !== undefined) existing.impact = impact;
      if (effort !== undefined) existing.effort = effort;
      if (due_at !== undefined) existing.due_at = due_at;
      if (title !== undefined) existing.title = title;
      existing.updated_at = event.ingested_at;
      break;
    }
    case TASK_EVENT_TYPES.TaskCompleted:
    case LEGACY_TASK_EVENT_TYPES.TaskCompleted: {
      const { task_id } = event.payload;
      const existing = next.tasks.get(task_id);
      if (!existing) break;
      existing.status = "completed";
      existing.updated_at = event.ingested_at;
      break;
    }
    case TASK_EVENT_TYPES.TaskReopened:
    case LEGACY_TASK_EVENT_TYPES.TaskReopened: {
      const { task_id } = event.payload;
      const existing = next.tasks.get(task_id);
      if (!existing) break;
      existing.status = "open";
      existing.updated_at = event.ingested_at;
      break;
    }
    default:
      break;
  }
  return next;
}

export function cloneState(state: TasksLedgerState): TasksLedgerState {
  const tasks = new Map<string, TaskState>();
  for (const [id, task] of state.tasks.entries()) {
    tasks.set(id, { ...task });
  }
  return { tasks };
}
